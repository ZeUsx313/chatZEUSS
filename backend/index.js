// =================================================================
// 1. التحميل اليدوي لمتغيرات البيئة (الحل الجذري)
// =================================================================
const fs = require('fs');
const path = require('path');

try {
    const envConfig = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
    console.log('✅ Environment variables loaded manually.');
} catch (error) {
    // ✨ لا توقف الخادم، فقط اعرض تحذيرًا بأنه سيستخدم متغيرات البيئة من المنصة ✨
    console.warn('⚠️  Could not find .env file. Using platform environment variables instead.');
}


// =================================================================
// 2. استدعاء المكتبات المطلوبة
// =================================================================
const http = require('http' );
const https = require('https' );
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors'); // Import cors
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/user.model.js');
const Chat = require('./models/chat.model.js');
const Settings = require('./models/settings.model.js');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// =================================================================
// 3. إعداد تطبيق Express والخادم
// =================================================================
const app = express();
const server = http.createServer(app );

// ✨ إعدادات CORS النهائية والمحصّنة ✨
app.use(cors({
  origin: 'https://chatzeus.vercel.app', // السماح لواجهتك الأمامية فقط
  credentials: true, // السماح بإرسال الكوكيز والتوكن
  allowedHeaders: ['Content-Type', 'Authorization'] // السماح بالهيدرات الضرورية
} ));

// معالجة طلبات OPTIONS تلقائيًا (مهم لـ pre-flight)
app.options('*', cors({
  origin: 'https://chatzeus.vercel.app',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
} ));

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://chatzeus-production.up.railway.app/auth/google/callback"
  );

app.use(express.json({ limit: '50mb' }));


// =================================================================
// 4. Middleware للتحقق من التوكن
// =================================================================
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // استخراج التوكن من 'Bearer TOKEN'

    if (token == null) {
        return res.status(401).json({ loggedIn: false, message: 'No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ loggedIn: false, message: 'Token is not valid.' });
        }
        req.user = user;
        next();
    });
}

// =================================================================
// 3.5 تهيئة مجلد الرفع + إعداد Multer
// =================================================================
const uploadsDir = path.join(__dirname, 'uploads');

// تأكد من وجود مجلد الرفع
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory at:', uploadsDir);
}

// إعداد التخزين لـ Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '');
    cb(null, `${uuidv4()}${ext}`);
  }
});

// فلترة بسيطة للأنواع المسموحة (اختياري — عدّل حسب حاجتك)
const allowedMime = new Set([
  'text/plain','text/markdown','text/csv','application/json','application/xml',
  'text/html','text/css','application/javascript',
  'image/jpeg','image/png','image/gif','image/webp','image/bmp'
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // اسمح بكل شيء أو قيّد بأنواع محددة
    if (!allowedMime.size || allowedMime.has(file.mimetype)) return cb(null, true);
    cb(new Error('نوع الملف غير مسموح'));
  }
});

// خدمة الملفات المرفوعة بشكل ثابت
app.use('/uploads', express.static(uploadsDir));

// =================================================================
// 5. نقاط النهاية (Routes)
// =================================================================
// =================================================================
// مسار رفع الملفات (يرجع معلومات يمكن حفظها داخل الرسالة فقط)
// =================================================================
app.post('/api/uploads', verifyToken, upload.array('files', 10), async (req, res) => {
  try {
    const files = (req.files || []).map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      size: f.size,
      mimeType: f.mimetype,
      // رابط HTTP يصلح للواجهة الأمامية لعرض/تحميل الملف لاحقًا
      url: `/uploads/${f.filename}`,
      // مسار فعلي على السيرفر (لا ترسله للواجهة لو لا تحتاجه)
      path: f.path
    }));

    return res.status(201).json({ files });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ message: 'فشل رفع الملفات', error: e.message });
  }
});

app.get('/auth/google', (req, res) => {
    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    } );
    res.redirect(authorizeUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const userInfoResponse = await oauth2Client.request({ url: 'https://www.googleapis.com/oauth2/v3/userinfo' } );
        const userInfo = userInfoResponse.data;

        // ابحث عن المستخدم في قاعدة البيانات أو أنشئ مستخدمًا جديدًا
        let user = await User.findOne({ googleId: userInfo.sub });

        if (!user) {
            // مستخدم جديد
            user = new User({
                googleId: userInfo.sub, // .sub هو المعرف الفريد من جوجل
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
            });
            await user.save();

            // إنشاء إعدادات افتراضية للمستخدم الجديد
            const newSettings = new Settings({ user: user._id });
            await newSettings.save();
            console.log(`✨ New user created and saved: ${user.email}`);
        } else {
            console.log(`👋 Welcome back, user: ${user.email}`);
        }

        // إنشاء حمولة التوكن مع معرّف قاعدة البيانات
        const payload = {
            id: user._id,
            googleId: user.googleId,
            name: user.name,
            email: user.email,
            picture: user.picture,
        };

        // توقيع التوكن
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        // إعادة التوجيه إلى الواجهة الأمامية مع التوكن
        res.redirect(`https://chatzeus.vercel.app/?token=${token}` );

    } catch (error) {
        console.error('Authentication callback error:', error);
        res.redirect('https://chatzeus.vercel.app/?auth_error=true' );
    }
});

app.get('/api/user', verifyToken, (req, res) => {
    // إذا وصل الطلب إلى هنا، فالـ middleware قد تحقق من التوكن بنجاح
    // ومعلومات المستخدم موجودة في req.user
    res.json({ loggedIn: true, user: req.user });
});

app.post('/api/chat', verifyToken, async (req, res) => {
    await handleChatRequest(req, res);
});

// =================================================================
// ✨ نقاط نهاية جديدة للبيانات (تضاف في القسم 5)
// =================================================================

app.get('/api/data', verifyToken, async (req, res) => {
    try {
        // 1. التحقق من صلاحية الـ ID في التوكن
        if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
            return res.status(400).json({ message: 'Invalid or missing user ID in token.' });
        }

        let user = await User.findById(req.user.id);

        // 2. خطة احتياطية: إذا لم يتم العثور على المستخدم بالـ ID، جرب googleId
        if (!user && req.user.googleId) {
            console.warn(`User not found by ID ${req.user.id}, trying googleId...`);
            user = await User.findOne({ googleId: req.user.googleId });

            // 3. إذا لم يكن موجودًا على الإطلاق، أنشئه الآن (هذا يمنع أي فشل)
            if (!user) {
                console.warn(`User not found by googleId either. Creating a new user record now.`);
                user = await User.create({
                    _id: req.user.id, // استخدم نفس الـ ID من التوكن لضمان التوافق
                    googleId: req.user.googleId,
                    email: req.user.email,
                    name: req.user.name,
                    picture: req.user.picture,
                });
            }
        }
        
        // إذا لم يتم العثور على المستخدم بعد كل المحاولات، فهناك مشكلة حقيقية
        if (!user) {
             return res.status(404).json({ message: 'User could not be found or created.' });
        }

        // 4. الآن بعد التأكد من وجود المستخدم، اجلب بياناته
        const chats = await Chat.find({ user: user._id }).sort({ order: -1 });
        let settings = await Settings.findOne({ user: user._id });

        // 5. إذا لم تكن لديه إعدادات، أنشئها
        if (!settings) {
            settings = await new Settings({ user: user._id }).save();
        }

        // 6. أرجع دائمًا ردًا ناجحًا
        return res.json({
            settings,
            chats,
            user: { id: user._id, name: user.name, picture: user.picture, email: user.email }
        });

    } catch (e) {
        console.error('FATAL Error in /api/data:', e);
        return res.status(500).json({ message: 'Failed to fetch user data.', error: e.message });
    }
});

// حفظ أو تحديث محادثة
app.post('/api/chats', verifyToken, async (req, res) => {
    try {
        const userIdString = req.user.id;
        // ✨ 1. التحقق من صلاحية معرّف المستخدم ✨
        if (!mongoose.Types.ObjectId.isValid(userIdString)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }
        const userId = new mongoose.Types.ObjectId(userIdString);
        const chatData = req.body;

        // إذا كانت المحادثة موجودة (لديها ID صالح)
        if (chatData._id && mongoose.Types.ObjectId.isValid(chatData._id)) {
            const updatedChat = await Chat.findOneAndUpdate(
                // ✨ 2. استخدام المعرّفات المحوّلة والصحيحة في الاستعلام ✨
                { _id: new mongoose.Types.ObjectId(chatData._id), user: userId },
                { ...chatData, user: userId },
                { new: true, runValidators: true }
            );
            // إذا لم يتم العثور على المحادثة (لأنها لا تخص المستخدم)، أرجع خطأ
            if (!updatedChat) {
                return res.status(404).json({ message: "Chat not found or user not authorized" });
            }
            res.json(updatedChat);
        } else {
            // إذا كانت محادثة جديدة، احذف أي ID قديم أو غير صالح
            delete chatData._id; 
            const newChat = new Chat({ ...chatData, user: userId });
            await newChat.save();
            res.status(201).json(newChat);
        }
    } catch (error) {
        console.error('Error saving chat:', error);
        res.status(500).json({ message: 'Failed to save chat' });
    }
});

app.put('/api/settings', verifyToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
            return res.status(400).json({ message: 'Invalid or missing user ID in token.' });
        }
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const receivedSettings = req.body;

        // ✨✨✨ الإصلاح الحاسم: انتقاء الحقول المعروفة فقط ✨✨✨
        const allowedUpdates = {
            provider: receivedSettings.provider,
            model: receivedSettings.model,
            temperature: receivedSettings.temperature,
            customPrompt: receivedSettings.customPrompt,
            apiKeyRetryStrategy: receivedSettings.apiKeyRetryStrategy,
            fontSize: receivedSettings.fontSize,
            geminiApiKeys: receivedSettings.geminiApiKeys,
            openrouterApiKeys: receivedSettings.openrouterApiKeys,
            customProviders: receivedSettings.customProviders,
            customModels: receivedSettings.customModels
        };

        // إزالة أي حقول غير معرفة (undefined) لتجنب المشاكل
        Object.keys(allowedUpdates).forEach(key => allowedUpdates[key] === undefined && delete allowedUpdates[key]);

        const updatedSettings = await Settings.findOneAndUpdate(
            { user: userId },
            { $set: allowedUpdates }, // استخدام $set لتحديث الحقول المحددة فقط
            { new: true, upsert: true, runValidators: false }
        );

        res.json(updatedSettings);

    } catch (error) {
        console.error('Error updating settings:', error);
        // إرسال رسالة خطأ أكثر تفصيلاً للمساعدة في التشخيص
        res.status(500).json({ message: 'Failed to update settings.', error: error.message });
    }
});

// حذف محادثة
app.delete('/api/chats/:chatId', verifyToken, async (req, res) => {
    try {
        const userIdString = req.user.id;
        const { chatId } = req.params;

        // ✨ 1. التحقق من صلاحية كلا المعرّفين قبل أي شيء ✨
        if (!mongoose.Types.ObjectId.isValid(userIdString) || !mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({ message: 'Invalid ID format.' });
        }

        // ✨ 2. استخدام المعرّفات المحوّلة والصحيحة في الاستعلام ✨
        const result = await Chat.findOneAndDelete({ 
            _id: new mongoose.Types.ObjectId(chatId), 
            user: new mongoose.Types.ObjectId(userIdString) 
        });

        if (!result) {
            // هذا يعني أن المحادثة غير موجودة أو لا تخص هذا المستخدم
            return res.status(404).json({ message: 'Chat not found or user not authorized' });
        }

        res.status(200).json({ message: 'Chat deleted successfully' });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ message: 'Failed to delete chat' });
    }
});

// =================================================================
// 5. عرض الملفات الثابتة
// =================================================================
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// مسار للصفحة الرئيسية فقط (بدلاً من * التي تسبب تضارب)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});


// =================================================================
// 6. دوال معالجة الدردشة (تبقى كما هي)
// =================================================================
const keyManager = {
    keys: {
        gemini: (process.env.GEMINI_API_KEYS || '').split(',').filter(k => k),
        openrouter: (process.env.OPENROUTER_API_KEYS || '').split(',').filter(k => k)
    },
    // هذا المتغير سيتتبع المفتاح التالي الذي يجب استخدامه لكل مزود
    indices: {
        gemini: 0,
        openrouter: 0
    },
    tryKeys: async function(provider, strategy, customKeys, action) {
        // تحديد مجموعة المفاتيح الصحيحة (إما مفاتيح المستخدم أو المفاتيح العامة)
        const keyPool = (customKeys && customKeys.length > 0) ? customKeys : this.keys[provider] || [];
        if (keyPool.length === 0) {
            throw new Error(`No API keys available for provider: ${provider}`);
        }

        // ✨✨✨ منطق توزيع الحمل الجديد يبدأ هنا ✨✨✨

        // 1. احصل على المؤشر الحالي للمفتاح الذي سنستخدمه هذه المرة
        // هذا المؤشر خاص بالمفاتيح العامة فقط (لا معنى لتوزيع الحمل على مفتاح مستخدم واحد)
        const keyIndex = (this.indices[provider] || 0);
        
        // 2. اختر المفتاح بناءً على المؤشر
        const keyToTry = keyPool[keyIndex];
        console.log(`[Key Manager] Load Balancing: Selected key index ${keyIndex} for provider ${provider}.`);

        try {
            // 3. حاول تنفيذ الطلب باستخدام المفتاح المختار
            const result = await action(keyToTry);
            
            // 4. ✨ في حالة النجاح، قم بتحديث المؤشر للمرة القادمة ✨
            // هذا هو سر توزيع الحمل: ننتقل إلى المفتاح التالي للطلب القادم
            this.indices[provider] = (keyIndex + 1) % keyPool.length;
            
            return result; // أرجع النتيجة الناجحة

        } catch (error) {
            console.error(`[Key Manager] Key index ${keyIndex} for ${provider} failed. Error: ${error.message}`);
            // في حالة الفشل، لا نزال نحدث المؤشر لتجنب استخدام نفس المفتاح الفاشل مرة أخرى
            this.indices[provider] = (keyIndex + 1) % keyPool.length;
            // ثم نرمي الخطأ ليعرف المستخدم أن الطلب فشل
            throw error;
        }
    }
};

async function handleChatRequest(req, res) {
    try {
        const payload = req.body;
        // ✨ التحقق من وجود الإعدادات والمزود قبل أي شيء آخر ✨
        if (!payload.settings || !payload.settings.provider) {
            // إذا لم يكن هناك مزود، أرسل خطأ واضحًا بدلاً من الانهيار
            throw new Error('Provider information is missing in the request settings.');
        }
        const { provider } = payload.settings;

        // الآن يمكننا استخدام 'provider' بأمان
        if (provider === 'gemini') await handleGeminiRequest(payload, res);
        else if (provider === 'openrouter') await handleOpenRouterRequest(payload, res);
        else if (provider.startsWith('custom_')) await handleCustomProviderRequest(payload, res);
        else throw new Error(`مزود غير معروف: ${provider}`);
        
    } catch (error) {
        console.error('Error processing chat request:', error.message);
        res.status(500).json({ error: error.message });
    }
}
async function handleGeminiRequest(payload, res) {
    const { chatHistory, attachments, settings } = payload;
    // ✨✨✨ الإصلاح هنا: استخراج مفاتيح المستخدم من الإعدادات ✨✨✨
    const userApiKeys = (settings.geminiApiKeys || []).map(k => k.key).filter(Boolean);
    
    await keyManager.tryKeys('gemini', settings.apiKeyRetryStrategy, userApiKeys, async (apiKey) => {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: settings.model });
        const history = chatHistory.slice(0, -1).map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content || '' }] }));
        const lastMessage = chatHistory[chatHistory.length - 1];
        const userParts = buildUserParts(lastMessage, attachments);
        const chat = model.startChat({ history, generationConfig: { temperature: settings.temperature } });
        const result = await chat.sendMessageStream(userParts);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' });
        for await (const chunk of result.stream) { res.write(chunk.text()); }
        res.end();
    });
}

async function handleOpenRouterRequest(payload, res) {
    const { chatHistory, settings } = payload;
    // ✨✨✨ الإصلاح هنا: استخراج مفاتيح المستخدم من الإعدادات ✨✨✨
    const userApiKeys = (settings.openrouterApiKeys || []).map(k => k.key).filter(Boolean);

    await keyManager.tryKeys('openrouter', settings.apiKeyRetryStrategy, userApiKeys, async (apiKey) => {
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
    return chatHistory.map(msg => ({ role: msg.role, content: msg.content || '' }));
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
            apiResponse.on('end', () => { res.end(); resolve(); });
        });
        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

// ✨✨✨ معالج الأخطاء العام (Global Error Handler) ✨✨✨
app.use((err, req, res, next) => {
    console.error('[GLOBAL ERROR HANDLER]:', err.stack);
    res.status(500).json({
        message: 'حدث خطأ غير متوقع في الخادم.',
        error: err.message 
    });
});


// =================================================================
// ✨ الاتصال بقاعدة البيانات
// =================================================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Successfully connected to MongoDB Atlas.'))
    .catch(err => {
        console.error('❌ Could not connect to MongoDB Atlas.', err);
        process.exit(1); // إيقاف الخادم إذا فشل الاتصال
    });

// =================================================================
// 7. تشغيل الخادم
// =================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Zeus Pro Server (Manual Env) is now running on http://0.0.0.0:${PORT}` );
});
