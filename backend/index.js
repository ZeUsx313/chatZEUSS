// 1. استدعاء المكتبات المطلوبة
require('dotenv').config();
const http = require('http' );
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const https = require('https' );

// =================================================================
// ✨ مدير المفاتيح الذكي (API Key Manager) ✨
// =================================================================
const keyManager = {
    keys: {
        gemini: (process.env.GEMINI_API_KEYS || '').split(',').filter(k => k),
        openrouter: (process.env.OPENROUTER_API_KEYS || '').split(',').filter(k => k)
    },
    indices: {
        gemini: 0,
        openrouter: 0
    },
    getKey: function(provider, strategy = 'sequential', customKeys = []) {
        let keyPool = customKeys.length > 0 ? customKeys : this.keys[provider] || [];
        if (keyPool.length === 0) return null;

        let key;
        if (strategy === 'round-robin') {
            const index = this.indices[provider] % keyPool.length;
            key = keyPool[index];
            this.indices[provider]++;
        } else { // sequential (default)
            key = keyPool[0]; // دائماً نبدأ بالأول في النمط التسلسلي
        }
        return key;
    },
    // دالة لتجربة المفاتيح بالتتابع عند الفشل
    tryKeys: async function(provider, strategy, customKeys, action) {
        const keyPool = customKeys.length > 0 ? customKeys : this.keys[provider] || [];
        if (keyPool.length === 0) throw new Error(`لا توجد مفاتيح API للمزود ${provider}`);

        for (let i = 0; i < keyPool.length; i++) {
            const key = keyPool[i];
            try {
                console.log(`[Key Manager] محاولة استخدام المفتاح ${i + 1} للمزود ${provider}`);
                return await action(key); // تنفيذ الإجراء مع المفتاح الحالي
            } catch (error) {
                console.error(`[Key Manager] فشل المفتاح ${i + 1} للمزود ${provider}:`, error.message);
                if (i === keyPool.length - 1) {
                    // إذا كان هذا آخر مفتاح، ارمِ الخطأ
                    throw new Error(`فشلت جميع مفاتيح API للمزود ${provider}.`);
                }
            }
        }
    }
};

// =================================================================
// الخادم الرئيسي والمنطق
// =================================================================

const server = http.createServer(async (req, res ) => {
    if (req.url === '/api/chat' && req.method === 'POST') {
        await handleChatRequest(req, res);
    } else {
        serveStaticFile(req, res);
    }
});

async function handleChatRequest(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const payload = JSON.parse(body);
            const { provider, customProviders } = payload.settings;

            // توجيه الطلب بناءً على المزود
            if (provider === 'gemini') {
                await handleGeminiRequest(payload, res);
            } else if (provider === 'openrouter') {
                await handleOpenRouterRequest(payload, res);
            } else if (provider.startsWith('custom_')) {
                await handleCustomProviderRequest(payload, res);
            } else {
                throw new Error('مزود غير معروف.');
            }
        } catch (error) {
            console.error('Error processing chat request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

// =================================================================
// دوال معالجة خاصة بكل مزود
// =================================================================

async function handleGeminiRequest(payload, res) {
    const { chatHistory, attachments, settings } = payload;

    await keyManager.tryKeys('gemini', settings.apiKeyRetryStrategy, [], async (apiKey) => {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: settings.model });
        const history = chatHistory.slice(0, -1).map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content || '' }] }));
        const lastMessage = chatHistory[chatHistory.length - 1];
        const userParts = buildUserParts(lastMessage, attachments);

        const chat = model.startChat({ history, generationConfig: { temperature: settings.temperature } });
        const result = await chat.sendMessageStream(userParts);

        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' });
        for await (const chunk of result.stream) {
            res.write(chunk.text());
        }
        res.end();
    });
}

async function handleOpenRouterRequest(payload, res) {
    const { chatHistory, settings } = payload;

    await keyManager.tryKeys('openrouter', settings.apiKeyRetryStrategy, [], async (apiKey) => {
        const formattedMessages = formatMessagesForOpenAI(chatHistory);
        const requestBody = JSON.stringify({ model: settings.model, messages: formattedMessages, temperature: settings.temperature, stream: true });
        const options = { hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } };

        await streamOpenAICompatibleAPI(options, requestBody, res);
    });
}

async function handleCustomProviderRequest(payload, res) {
    const { chatHistory, settings, customProviders } = payload;
    const providerId = settings.provider;
    const providerConfig = customProviders.find(p => p.id === providerId);

    if (!providerConfig) throw new Error(`لم يتم العثور على إعدادات المزود المخصص: ${providerId}`);

    const customKeys = (providerConfig.apiKeys || []).map(k => k.key).filter(Boolean);

    await keyManager.tryKeys(providerId, settings.apiKeyRetryStrategy, customKeys, async (apiKey) => {
        const formattedMessages = formatMessagesForOpenAI(chatHistory);
        const requestBody = JSON.stringify({ model: settings.model, messages: formattedMessages, temperature: settings.temperature, stream: true });

        const url = new URL(providerConfig.baseUrl);
        const options = { hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } };

        await streamOpenAICompatibleAPI(options, requestBody, res);
    });
}

// =================================================================
// دوال مساعدة
// =================================================================

function buildUserParts(lastMessage, attachments) {
    const userParts = [];
    if (lastMessage.content) userParts.push({ text: lastMessage.content });
    if (attachments) {
        attachments.forEach(file => {
            if (file.dataType === 'image' && file.content) {
                userParts.push({ inline_data: { mime_type: file.mimeType, data: file.content } });
            } else if (file.dataType === 'text' && file.content) {
                userParts.push({ text: `\n\n--- محتوى الملف: ${file.name} ---\n${file.content}\n--- نهاية الملف ---` });
            }
        });
    }
    if (userParts.length > 0 && userParts.every(p => !p.text)) {
        userParts.unshift({ text: "حلل المرفقات:" });
    }
    return userParts;
}

function formatMessagesForOpenAI(chatHistory) {
    return chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content || ''
    }));
}

function streamOpenAICompatibleAPI(options, body, res) {
    return new Promise((resolve, reject) => {
        const request = https.request(options, (apiResponse ) => {
            if (apiResponse.statusCode !== 200) {
                let errorBody = '';
                apiResponse.on('data', d => errorBody += d);
                apiResponse.on('end', () => reject(new Error(`API Error: ${apiResponse.statusCode} - ${errorBody}`)));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' });
            apiResponse.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data.trim() === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            const text = parsed.choices?.[0]?.delta?.content || '';
                            if (text) res.write(text);
                        } catch (e) {}
                    }
                }
            });
            apiResponse.on('end', () => {
                res.end();
                resolve();
            });
        });
        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

function serveStaticFile(req, res) {
    const filePath = req.url === '/' ? '/frontend/index.html' : `/frontend${req.url}`;
    const fullPath = path.join(__dirname, '..', filePath.split('?')[0]);
    const contentTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
    fs.readFile(fullPath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentTypes[path.extname(fullPath)] || 'application/octet-stream' });
            res.end(content, 'utf-8');
        }
    });
}

// =================================================================
// تشغيل الخادم
// =================================================================
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Zeus Pro Server is now fully operational on http://localhost:${PORT}` );
});
