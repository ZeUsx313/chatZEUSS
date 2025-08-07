// API Endpoint for the backend
const API_ENDPOINT = '/api/chat';

// Global state
let currentChatId = null;
let chats = {};
let settings = {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    temperature: 0.7,
    geminiApiKeys: [],
    openrouterApiKeys: [],
    customProviders: [], // قائمة المزودين المخصصين مع مفاتيح API متعددة لكل مزود
    customModels: [], // النماذج المخصصة الجديدة
    customPrompt: '',
    apiKeyRetryStrategy: 'sequential',
    fontSize: 18 // Default font size in pixels
};

// Provider configurations
const providers = {
    gemini: {
        name: 'Google Gemini',
        models: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-pro', name: 'Gemini Pro' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
        ]
    },
    openrouter: {
        name: 'OpenRouter',
        models: [
            { id: 'google/gemma-2-9b-it:free', name: 'Google: Gemma 2 9B (مجاني)' },
            { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek: R1 (مجاني)' },
            { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen: Qwen3 Coder (مجاني)' },
            { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Meta: Llama 3.2 3B (مجاني)' },
            { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Microsoft: Phi-3 Mini (مجاني)' },
            { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Hugging Face: Zephyr 7B (مجاني)' }
        ]
    }
    // سيتم إضافة المزودين المخصصين ديناميكياً
};

// File type detection and icons system
const fileTypeConfig = {
    // Programming files
    js: { icon: 'fab fa-js-square', color: 'file-icon-js', type: 'كود JavaScript' },
    html: { icon: 'fab fa-html5', color: 'file-icon-html', type: 'ملف HTML' },
    css: { icon: 'fab fa-css3-alt', color: 'file-icon-css', type: 'ملف CSS' },
    php: { icon: 'fab fa-php', color: 'file-icon-php', type: 'كود PHP' },
    py: { icon: 'fab fa-python', color: 'file-icon-python', type: 'كود Python' },
    java: { icon: 'fab fa-java', color: 'file-icon-java', type: 'كود Java' },
    cpp: { icon: 'fas fa-code', color: 'file-icon-cpp', type: 'كود C++' },
    c: { icon: 'fas fa-code', color: 'file-icon-cpp', type: 'كود C' },
    cs: { icon: 'fas fa-code', color: 'file-icon-csharp', type: 'كود C#' },
    rb: { icon: 'fas fa-gem', color: 'file-icon-ruby', type: 'كود Ruby' },

    // Data files
    json: { icon: 'fas fa-brackets-curly', color: 'file-icon-json', type: 'ملف JSON' },
    xml: { icon: 'fas fa-code', color: 'file-icon-xml', type: 'ملف XML' },
    csv: { icon: 'fas fa-table', color: 'file-icon-csv', type: 'ملف CSV' },
    yaml: { icon: 'fas fa-file-code', color: 'file-icon-yaml', type: 'ملف YAML' },
    yml: { icon: 'fas fa-file-code', color: 'file-icon-yaml', type: 'ملف YAML' },
    sql: { icon: 'fas fa-database', color: 'file-icon-sql', type: 'ملف SQL' },

    // Text files
    txt: { icon: 'fas fa-file-alt', color: 'file-icon-txt', type: 'ملف نصي' },
    md: { icon: 'fab fa-markdown', color: 'file-icon-md', type: 'ملف Markdown' },
    log: { icon: 'fas fa-file-medical-alt', color: 'file-icon-log', type: 'ملف سجل' },
    readme: { icon: 'fas fa-info-circle', color: 'file-icon-md', type: 'ملف تعليمات' },

    // Config files
    env: { icon: 'fas fa-cog', color: 'file-icon-config', type: 'ملف تكوين' },
    config: { icon: 'fas fa-cog', color: 'file-icon-config', type: 'ملف تكوين' },
    ini: { icon: 'fas fa-cog', color: 'file-icon-config', type: 'ملف تكوين' },
    gitignore: { icon: 'fab fa-git-alt', color: 'file-icon-config', type: 'ملف Git' }
};

// Streaming state management
let streamingState = {
    isStreaming: false,
    currentMessageId: null,
    streamController: null,
    currentText: '',
    streamingElement: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeDarkMode();
    loadData();
    updateCustomProviders(); // تحديث المزودين المخصصين
    updateSendButton();
    initializeEventListeners();
    displayChatHistory();
    updateProviderUI();

    if (currentChatId && chats[currentChatId]) {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('messagesContainer').classList.remove('hidden');
        displayMessages();
    }
});

// تحديث المزودين المخصصين في كائن providers
function updateCustomProviders() {
    // إزالة المزودين المخصصين القدامى
    Object.keys(providers).forEach(key => {
        if (key.startsWith('custom_')) {
            delete providers[key];
        }
    });

    // إضافة المزودين المخصصين الجدد
    settings.customProviders.forEach(provider => {
        providers[provider.id] = {
            name: provider.name,
            models: provider.models || []
        };
    });
}

function initializeEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const temperatureSlider = document.getElementById('temperatureSlider');
    const providerSelect = document.getElementById('providerSelect');

    if (messageInput) {
        messageInput.addEventListener('input', function() {
            updateSendButton();
            // Auto-resize textarea
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 128) + 'px';
        });

        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (temperatureSlider) {
        temperatureSlider.addEventListener('input', function() {
            document.getElementById('temperatureValue').textContent = this.value;
        });
    }

    if (providerSelect) {
        providerSelect.addEventListener('change', function() {
            updateProviderUI();
            updateModelOptions();
        });
    }

    const fontSizeSlider = document.getElementById('fontSizeSlider');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', function() {
            const size = this.value;
            document.getElementById('fontSizeValue').textContent = `${size}px`;
            updateFontSize(size);
        });
    }
}

// --- New Function ---
function updateFontSize(size) {
    document.documentElement.style.setProperty('--message-font-size', `${size}px`);
}

// Provider and model management
function updateProviderUI() {
    const provider = document.getElementById('providerSelect').value;
    const geminiSection = document.getElementById('geminiApiKeysSection');
    const openrouterSection = document.getElementById('openrouterApiKeysSection');
    const customSection = document.getElementById('customProviderApiKeysSection');

    // إخفاء جميع الأقسام أولاً
    geminiSection.classList.add('hidden');
    openrouterSection.classList.add('hidden');
    if (customSection) customSection.classList.add('hidden');

    // إظهار القسم المناسب
    if (provider === 'gemini') {
        geminiSection.classList.remove('hidden');
    } else if (provider === 'openrouter') {
        openrouterSection.classList.remove('hidden');
    } else if (provider.startsWith('custom_')) {
        // مزود مخصص - إظهار قسم مفاتيح API الخاص به
        if (customSection) {
            customSection.classList.remove('hidden');
            updateCustomProviderApiKeysUI(provider);
        }
    }

    updateModelOptions();
}

// تحديث واجهة مفاتيح API للمزود المخصص المحدد
function updateCustomProviderApiKeysUI(providerId) {
    const customProvider = settings.customProviders.find(p => p.id === providerId);
    if (!customProvider) return;

    // تحديث عنوان القسم
    const label = document.getElementById('customProviderApiKeysLabel');
    if (label) {
        label.textContent = `مفاتيح ${customProvider.name} API`;
    }

    // عرض مفاتيح API
    renderCustomProviderApiKeys(providerId);
}

function updateModelOptions() {
    const provider = document.getElementById('providerSelect').value;
    const modelSelect = document.getElementById('modelSelect');

    modelSelect.innerHTML = '';

    if (providers[provider]) {
        // عرض النماذج للمزود المحدد
        providers[provider].models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
    }

    // تعيين النموذج الحالي إذا كان موجوداً
    const currentModel = settings.model;
    const modelExists = Array.from(modelSelect.options).some(option => option.value === currentModel);

    if (modelExists) {
        modelSelect.value = currentModel;
    } else {
        // إذا لم يكن النموذج الحالي موجوداً، اختر الأول
        if (modelSelect.options.length > 0) {
            modelSelect.value = modelSelect.options[0].value;
        }
    }
}

// إدارة مفاتيح API للمزودين المخصصين
function renderCustomProviderApiKeys(providerId) {
    const customProvider = settings.customProviders.find(p => p.id === providerId);
    if (!customProvider) return;

    const container = document.getElementById('customProviderApiKeysContainer');
    container.innerHTML = '';

    if (!customProvider.apiKeys || customProvider.apiKeys.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-4">
                <i class="fas fa-key text-2xl mb-2"></i>
                <p>لا توجد مفاتيح API بعد</p>
                <p class="text-xs">اضغط على "أضف مفتاحاً جديداً" لإضافة مفتاح API</p>
            </div>
        `;
        return;
    }

    customProvider.apiKeys.forEach((apiKey, index) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'flex items-center space-x-3 space-x-reverse';
        keyDiv.innerHTML = `
            <div class="relative flex-1">
                <input type="password" value="${apiKey.key}" 
                    onchange="updateCustomProviderApiKeyValue('${providerId}', ${index}, this.value)"
                    id="customProviderApiKeyInput-${providerId}-${index}"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-base pl-10 backdrop-blur-sm"
                    placeholder="أدخل مفتاح API">
                <button type="button" onclick="toggleCustomProviderApiKeyVisibility('${providerId}', ${index})" 
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i id="customProviderApiKeyToggleIcon-${providerId}-${index}" class="fas fa-eye"></i>
                </button>
            </div>
            <div class="flex items-center space-x-2 space-x-reverse">
                <span class="status-indicator ${apiKey.status === 'active' ? 'bg-green-500' : 'bg-red-500'} w-3 h-3 rounded-full"></span>
                <span class="text-xs text-gray-500 dark:text-gray-400">${apiKey.status === 'active' ? 'نشط' : 'معطل'}</span>
            </div>
            <button onclick="removeCustomProviderApiKey('${providerId}', ${index})" 
                class="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                <i class="fas fa-trash text-sm"></i>
            </button>
        `;
        container.appendChild(keyDiv);
    });
}

function addCustomProviderApiKey() {
    const provider = document.getElementById('providerSelect').value;
    if (!provider.startsWith('custom_')) return;

    const customProvider = settings.customProviders.find(p => p.id === provider);
    if (!customProvider) return;

    if (!customProvider.apiKeys) {
        customProvider.apiKeys = [];
    }

    customProvider.apiKeys.push({
        key: '',
        status: 'active'
    });

    renderCustomProviderApiKeys(provider);
}

function removeCustomProviderApiKey(providerId, index) {
    const customProvider = settings.customProviders.find(p => p.id === providerId);
    if (!customProvider || !customProvider.apiKeys) return;

    customProvider.apiKeys.splice(index, 1);
    renderCustomProviderApiKeys(providerId);
}

function updateCustomProviderApiKeyValue(providerId, index, value) {
    const customProvider = settings.customProviders.find(p => p.id === providerId);
    if (!customProvider || !customProvider.apiKeys || !customProvider.apiKeys[index]) return;

    customProvider.apiKeys[index].key = value;
}

function toggleCustomProviderApiKeyVisibility(providerId, index) {
    const input = document.getElementById(`customProviderApiKeyInput-${providerId}-${index}`);
    const icon = document.getElementById(`customProviderApiKeyToggleIcon-${providerId}-${index}`);

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// إدارة المزودين المخصصين
function openCustomProvidersManager() {
    document.getElementById('customProvidersModal').classList.remove('hidden');
    renderCustomProviders();
}

function closeCustomProvidersManager() {
    document.getElementById('customProvidersModal').classList.add('hidden');
}

function renderCustomProviders() {
    const container = document.getElementById('customProvidersContainer');
    container.innerHTML = '';

    if (settings.customProviders.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-server text-4xl mb-4"></i>
                <p>لا توجد مزودين مخصصين بعد</p>
                <p class="text-sm">اضغط على "إضافة مزود جديد" لإنشاء مزود مخصص</p>
            </div>
        `;
        return;
    }

    settings.customProviders.forEach((provider, index) => {
        const providerCard = document.createElement('div');
        providerCard.className = 'glass-effect p-4 rounded-lg border border-gray-300 dark:border-gray-600';
        providerCard.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <input type="text" value="${provider.name}" 
                        onchange="updateCustomProviderName(${index}, this.value)"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-base backdrop-blur-sm"
                        placeholder="اسم المزود">
                </div>
                <button onclick="removeCustomProvider(${index})" 
                    class="p-2 ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="mb-3">
                <input type="text" value="${provider.baseUrl || ''}" 
                    onchange="updateCustomProviderBaseUrl(${index}, this.value)"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-base backdrop-blur-sm"
                    placeholder="رابط API الأساسي">
            </div>
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">النماذج:</span>
                    <button onclick="addCustomProviderModel(${index})" 
                        class="text-xs text-zeus-accent hover:text-zeus-accent-hover transition-colors">
                        <i class="fas fa-plus ml-1"></i>إضافة نموذج
                    </button>
                </div>
                <div id="customProviderModels-${index}" class="space-y-2">
                    ${provider.models ? provider.models.map((model, modelIndex) => `
                        <div class="flex items-center space-x-2 space-x-reverse">
                            <input type="text" value="${model.id}" 
                                onchange="updateCustomProviderModelId(${index}, ${modelIndex}, this.value)"
                                class="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-sm"
                                placeholder="معرف النموذج">
                            <input type="text" value="${model.name}" 
                                onchange="updateCustomProviderModelName(${index}, ${modelIndex}, this.value)"
                                class="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-sm"
                                placeholder="اسم النموذج">
                            <button onclick="removeCustomProviderModel(${index}, ${modelIndex})" 
                                class="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                                <i class="fas fa-times text-xs"></i>
                            </button>
                        </div>
                    `).join('') : ''}
                </div>
            </div>
        `;
        container.appendChild(providerCard);
    });
}

function addCustomProvider() {
    const newId = `custom_${Date.now()}`;
    settings.customProviders.push({
        id: newId,
        name: 'مزود مخصص جديد',
        baseUrl: '',
        models: [],
        apiKeys: []
    });
    renderCustomProviders();
    updateCustomProviders();
    updateProviderSelect();
}

function removeCustomProvider(index) {
    settings.customProviders.splice(index, 1);
    renderCustomProviders();
    updateCustomProviders();
    updateProviderSelect();
}

function updateCustomProviderName(index, name) {
    if (settings.customProviders[index]) {
        settings.customProviders[index].name = name;
        updateCustomProviders();
        updateProviderSelect();
    }
}

function updateCustomProviderBaseUrl(index, baseUrl) {
    if (settings.customProviders[index]) {
        settings.customProviders[index].baseUrl = baseUrl;
    }
}

function addCustomProviderModel(providerIndex) {
    if (!settings.customProviders[providerIndex].models) {
        settings.customProviders[providerIndex].models = [];
    }
    settings.customProviders[providerIndex].models.push({
        id: '',
        name: ''
    });
    renderCustomProviders();
    updateCustomProviders();
}

function removeCustomProviderModel(providerIndex, modelIndex) {
    settings.customProviders[providerIndex].models.splice(modelIndex, 1);
    renderCustomProviders();
    updateCustomProviders();
}

function updateCustomProviderModelId(providerIndex, modelIndex, id) {
    if (settings.customProviders[providerIndex] && settings.customProviders[providerIndex].models[modelIndex]) {
        settings.customProviders[providerIndex].models[modelIndex].id = id;
        updateCustomProviders();
    }
}

function updateCustomProviderModelName(providerIndex, modelIndex, name) {
    if (settings.customProviders[providerIndex] && settings.customProviders[providerIndex].models[modelIndex]) {
        settings.customProviders[providerIndex].models[modelIndex].name = name;
        updateCustomProviders();
    }
}

function updateProviderSelect() {
    const providerSelect = document.getElementById('providerSelect');
    const currentValue = providerSelect.value;

    // إزالة المزودين المخصصين القدامى
    const options = Array.from(providerSelect.options);
    options.forEach(option => {
        if (option.value.startsWith('custom_')) {
            providerSelect.removeChild(option);
        }
    });

    // إضافة المزودين المخصصين الجدد
    settings.customProviders.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name;
        providerSelect.appendChild(option);
    });

    // استعادة القيمة المحددة إذا كانت لا تزال موجودة
    const stillExists = Array.from(providerSelect.options).some(option => option.value === currentValue);
    if (stillExists) {
        providerSelect.value = currentValue;
    }
}

// إدارة النماذج المخصصة
function openCustomModelsManager() {
    document.getElementById('customModelsModal').classList.remove('hidden');
    renderCustomModels();
}

function closeCustomModelsManager() {
    document.getElementById('customModelsModal').classList.add('hidden');
}

function renderCustomModels() {
    const container = document.getElementById('customModelsContainer');
    container.innerHTML = '';

    if (settings.customModels.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-brain text-4xl mb-4"></i>
                <p>لا توجد نماذج مخصصة بعد</p>
                <p class="text-sm">اضغط على "إضافة نموذج مخصص جديد" لإنشاء نموذج مخصص</p>
            </div>
        `;
        return;
    }

    settings.customModels.forEach((model, index) => {
        const modelCard = document.createElement('div');
        modelCard.className = 'custom-model-card glass-effect p-4 rounded-lg border border-gray-300 dark:border-gray-600';
        modelCard.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1 grid grid-cols-2 gap-3">
                    <div>
                        <label class="form-label">اسم النموذج</label>
                        <input type="text" value="${model.name}" 
                            onchange="updateCustomModelName(${index}, this.value)"
                            class="form-input"
                            placeholder="اسم النموذج">
                    </div>
                    <div>
                        <label class="form-label">معرف النموذج</label>
                        <input type="text" value="${model.id}" 
                            onchange="updateCustomModelId(${index}, this.value)"
                            class="form-input"
                            placeholder="معرف النموذج">
                    </div>
                </div>
                <button onclick="removeCustomModel(${index})" 
                    class="p-2 ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="form-label">المزود</label>
                    <select onchange="updateCustomModelProvider(${index}, this.value)" class="form-input">
                        <option value="gemini" ${model.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
                        <option value="openrouter" ${model.provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
                        ${settings.customProviders.map(p => `
                            <option value="${p.id}" ${model.provider === p.id ? 'selected' : ''}>${p.name}</option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label class="form-label">درجة الحرارة الافتراضية</label>
                    <input type="number" min="0" max="1" step="0.1" value="${model.defaultTemperature || 0.7}" 
                        onchange="updateCustomModelTemperature(${index}, this.value)"
                        class="form-input"
                        placeholder="0.7">
                </div>
            </div>
            <div>
                <label class="form-label">وصف النموذج</label>
                <textarea onchange="updateCustomModelDescription(${index}, this.value)" 
                    class="form-input form-textarea"
                    placeholder="وصف مختصر للنموذج">${model.description || ''}</textarea>
            </div>
        `;
        container.appendChild(modelCard);
    });
}

function addCustomModel() {
    settings.customModels.push({
        id: '',
        name: 'نموذج مخصص جديد',
        provider: 'gemini',
        defaultTemperature: 0.7,
        description: ''
    });
    renderCustomModels();
}

function removeCustomModel(index) {
    settings.customModels.splice(index, 1);
    renderCustomModels();
}

function updateCustomModelName(index, name) {
    if (settings.customModels[index]) {
        settings.customModels[index].name = name;
    }
}

function updateCustomModelId(index, id) {
    if (settings.customModels[index]) {
        settings.customModels[index].id = id;
    }
}

function updateCustomModelProvider(index, provider) {
    if (settings.customModels[index]) {
        settings.customModels[index].provider = provider;
    }
}

function updateCustomModelTemperature(index, temperature) {
    if (settings.customModels[index]) {
        settings.customModels[index].defaultTemperature = parseFloat(temperature);
    }
}

function updateCustomModelDescription(index, description) {
    if (settings.customModels[index]) {
        settings.customModels[index].description = description;
    }
}

// File handling functions - MODIFIED to stop displaying content
function getFileTypeInfo(filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    return fileTypeConfig[extension] || {
        icon: 'fas fa-file',
        color: 'file-icon-default',
        type: 'ملف'
    };
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 بايت';
    const k = 1024;
    const sizes = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function createFileCard(file) {
    const fileInfo = getFileTypeInfo(file.name);
    const fileSize = formatFileSize(file.size);

    const cardHtml = `
        <div class="file-card-bubble">
            <div class="file-card">
                <div class="file-icon-container ${fileInfo.color}">
                    <i class="${fileInfo.icon}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">${fileInfo.type} • ${fileSize}</div>
                </div>
            </div>
        </div>
    `;

    return cardHtml;
}

// CRITICAL MODIFICATION: processAttachedFiles now collects metadata and content for API
async function processAttachedFiles(files) {
    const fileData = [];

    for (const file of files) {
        // جمع البيانات الوصفية للملف
        const fileInfo = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            fileObject: file // Keep reference for actual processing when needed
        };

        // تحديد امتدادات الملفات النصية والصور
        const textExtensions = ['txt', 'js', 'html', 'css', 'json', 'xml', 'md', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'sql', 'yaml', 'yml', 'csv', 'log'];
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
        const extension = file.name.split('.').pop()?.toLowerCase();

        // التحقق إذا كان الملف نصيًا
        if (textExtensions.includes(extension)) {
            try {
                const content = await readFileAsText(file);
                fileInfo.content = content; // تخزين المحتوى للاستخدام في الـ API
                fileInfo.dataType = 'text'; // ✨ إضافة: تحديد نوع البيانات كنص
            } catch (error) {
                console.error('Error reading file:', error);
                fileInfo.content = `خطأ في قراءة الملف: ${file.name}`;
            }
        } 
        // ✨ إضافة: التحقق إذا كان الملف صورة
        else if (imageExtensions.includes(extension) || file.type.startsWith('image/')) {
            try {
                const content = await readFileAsBase64(file); // استخدام الدالة الجديدة للصور
                fileInfo.content = content; // تخزين محتوى الصورة كـ Base64
                fileInfo.dataType = 'image'; // تحديد نوع البيانات كصورة
                fileInfo.mimeType = file.type; // حفظ نوع MIME (مهم جدًا للـ API)
            } catch (error) {
                console.error('Error reading image file:', error);
                fileInfo.content = `خطأ في قراءة الصورة: ${file.name}`;
            }
        }

        fileData.push(fileInfo);
    }

    return fileData;
}


function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// دالة جديدة لقراءة الملفات كـ Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // نزيل الجزء الأول من السلسلة "data:image/jpeg;base64,"
            const base64String = reader.result
                .replace('data:', '')
                .replace(/^.+,/, '');
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


// File preview functions for input area
function handleFileSelection(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    displayFilePreview(files);
}

function displayFilePreview(files) {
    const container = document.getElementById('filePreviewContainer');
    const list = document.getElementById('filePreviewList');

    list.innerHTML = '';

    files.forEach((file, index) => {
        const fileInfo = getFileTypeInfo(file.name);
        const fileSize = formatFileSize(file.size);

        const preview = document.createElement('div');
        preview.className = 'inline-flex items-center bg-gray-700 rounded-lg px-3 py-2 text-sm';
        preview.innerHTML = `
            <div class="file-icon-container ${fileInfo.color} w-6 h-6 text-xs mr-2">
                <i class="${fileInfo.icon}"></i>
            </div>
            <span class="text-gray-200 mr-2">${file.name}</span>
            <span class="text-gray-400 text-xs mr-2">(${fileSize})</span>
            <button onclick="removeFileFromPreview(${index})" class="text-gray-400 hover:text-gray-200 ml-1">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
        list.appendChild(preview);
    });

    container.classList.remove('hidden');
}

function removeFileFromPreview(index) {
    const fileInput = document.getElementById('fileInput');
    const files = Array.from(fileInput.files);

    files.splice(index, 1);

    // Create new FileList
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;

    if (files.length === 0) {
        clearFileInput();
    } else {
        displayFilePreview(files);
    }
}

function clearFileInput() {
    document.getElementById('fileInput').value = '';
    document.getElementById('filePreviewContainer').classList.add('hidden');
}

// Advanced streaming functions
function createStreamingMessage(sender = 'assistant') {
    const messageId = Date.now().toString();
    const messagesArea = document.getElementById('messagesArea');

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-bubble message-${sender} streaming-message`;
    messageDiv.id = `message-${messageId}`;

    messageDiv.innerHTML = `
        <div class="message-content" id="content-${messageId}">
            <span class="streaming-cursor"></span>
        </div>
        <div class="streaming-indicator">
            <i class="fas fa-robot text-xs"></i>
            <span>يكتب زيوس</span>
            <div class="streaming-dots">
                <div class="streaming-dot"></div>
                <div class="streaming-dot"></div>
                <div class="streaming-dot"></div>
            </div>
        </div>
    `;

    messagesArea.appendChild(messageDiv);
    scrollToBottom();

    streamingState.currentMessageId = messageId;
    streamingState.streamingElement = document.getElementById(`content-${messageId}`);
    streamingState.currentText = '';
    streamingState.isStreaming = true;

    return messageId;
}

function appendToStreamingMessage(text, isComplete = false) {
    if (!streamingState.isStreaming || !streamingState.streamingElement) return;

    streamingState.currentText += text;

    // Remove cursor temporarily
    const cursor = streamingState.streamingElement.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();

    // Update content with markdown rendering
    const renderedContent = marked.parse(streamingState.currentText);
    streamingState.streamingElement.innerHTML = renderedContent;

    // Add cursor back if not complete
    if (!isComplete) {
        const newCursor = document.createElement('span');
        newCursor.className = 'streaming-cursor';
        streamingState.streamingElement.appendChild(newCursor);
    }

    // Highlight code blocks
    streamingState.streamingElement.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
        addCodeHeader(block.parentElement);
    });

    // Smooth scroll to bottom
    smoothScrollToBottom();

    if (isComplete) {
        completeStreamingMessage();
    }
}

function completeStreamingMessage() {
    if (!streamingState.isStreaming) return;

    const messageElement = document.getElementById(`message-${streamingState.currentMessageId}`);
    if (messageElement) {
        // Remove streaming indicator
        const indicator = messageElement.querySelector('.streaming-indicator');
        if (indicator) indicator.remove();

        // Remove streaming class
        messageElement.classList.remove('streaming-message');

        // Add message actions
        addMessageActions(messageElement, streamingState.currentText);
    }

    // Save assistant message to chat
    if (currentChatId && streamingState.currentText) {
        const now = Date.now();
        chats[currentChatId].messages.push({
            role: 'assistant',
            content: streamingState.currentText,
            timestamp: now
        });
        chats[currentChatId].updatedAt = now;
        chats[currentChatId].order = now; // Bring chat to top on new message

        // Save data to localStorage
        saveData();
    }

    // Reset streaming state
    streamingState.isStreaming = false;
    streamingState.currentMessageId = null;
    streamingState.streamingElement = null;
    streamingState.currentText = '';
    streamingState.streamController = null;

    scrollToBottom();
}

function smoothScrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.scrollTo({
        top: messagesArea.scrollHeight,
        behavior: 'smooth'
    });
}

// Enhanced message sending with streaming
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const fileInput = document.getElementById('fileInput');

    if (!input.value.trim() && fileInput.files.length === 0) return;

    const message = input.value.trim();
    const files = Array.from(fileInput.files);

    // The API key check is no longer needed on the frontend.
    // The backend will handle API key management.

    console.log('Sending message to backend with provider:', settings.provider, 'model:', settings.model);

    // Disable input during processing
    input.disabled = true;
    sendButton.disabled = true;

    try {
        // Create new chat if needed
        if (!currentChatId) {
            await startNewChat();
        }

        // Process files if any
        let attachments = [];
        if (files.length > 0) {
            attachments = await processAttachedFiles(files);
        }

        // Create user message
        const userMessage = {
            role: 'user',
            content: message,
            attachments: attachments.map(file => ({
                name: file.name,
                size: file.size,
                type: file.type
            })),
            timestamp: Date.now()
        };

        // Add user message to chat
        chats[currentChatId].messages.push(userMessage);

        // Display user message with file cards
        displayUserMessage(userMessage);

        // Scroll to show new message
        setTimeout(() => scrollToBottom(), 100);

        // Clear input
        input.value = '';
        clearFileInput();

        // Show welcome screen if hidden
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('messagesContainer').classList.remove('hidden');

        // Create streaming message for assistant response
        createStreamingMessage();

        // Send to AI with streaming
        await sendToAIWithStreaming(chats[currentChatId].messages, attachments);

    } catch (error) {
        console.error('Error sending message:', error);
        showNotification(`حدث خطأ: ${error.message}`, 'error');

        // Complete streaming message with error
        if (streamingState.isStreaming) {
            appendToStreamingMessage('\n\n❌ عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.', true);
        }
    } finally {
        // Re-enable input
        input.disabled = false;
        sendButton.disabled = false;
        updateSendButton();
        input.focus();

        // Data will be saved when streaming completes
    }
}

function displayUserMessage(message) {
    const messagesArea = document.getElementById('messagesArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-bubble message-user';

    let content = `<div class="message-content">${escapeHtml(message.content)}</div>`;

    // Add file cards if there are attachments
    if (message.attachments && message.attachments.length > 0) {
        const fileCards = message.attachments.map(file => createFileCard(file)).join('');
        content += fileCards;
    }

    messageDiv.innerHTML = content;
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

// ----------------------------------------------------------------------------------
// NEW: Functions to communicate with the local backend server
// ----------------------------------------------------------------------------------

async function sendToAIWithStreaming(chatHistory, attachments) {
    // 1. تجميع البيانات المطلوبة في كائن payload
    const payload = {
        chatHistory: chatHistory,
        attachments: attachments.map(file => {
            // نرسل فقط البيانات الضرورية للخادم
            return {
                name: file.name,
                type: file.type,
                size: file.size,
                content: file.content, // Base64 for images, text for others
                dataType: file.dataType,
                mimeType: file.mimeType
            };
        }),
        settings: {
            provider: settings.provider,
            model: settings.model,
            temperature: settings.temperature,
            customPrompt: settings.customPrompt,
            // لا نرسل مفاتيح API، الخادم هو من سيتعامل معها
        }
    };

    // 2. استدعاء الدالة الجديدة التي تتصل بالخادم
    try {
        await sendRequestToServer(payload);
    } catch (error) {
        console.error('Error sending request to server:', error);
        // عرض الخطأ في الواجهة
        appendToStreamingMessage(`\n\n❌ حدث خطأ أثناء الاتصال بالخادم: ${error.message}`, true);
    }
}


async function sendRequestToServer(payload) {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server Error:', response.status, errorText);
            throw new Error(`خطأ من الخادم: ${response.status} - ${errorText}`);
        }

        // معالجة الرد المتدفق
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            appendToStreamingMessage(chunk);
        }

        // إنهاء البث
        appendToStreamingMessage('', true);

    } catch (error) {
        console.error('Fetch error:', error);
        throw error; // إعادة رمي الخطأ ليتم التعامل معه في دالة sendMessage
    }
}


// ----------------------------------------------------------------------------------
// OLD: Direct API communication functions (now disabled/commented out)
// ----------------------------------------------------------------------------------

/*
async function sendToGeminiSimple(messages, attachments) {
    const apiKeys = settings.geminiApiKeys.filter(key => key.status === 'active').map(key => key.key);
    if (apiKeys.length === 0) {
        throw new Error('لا توجد مفاتيح Gemini API نشطة');
    }

    // Try each API key with fallback
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        const model = settings.model;

        try {
            console.log(`Trying Gemini API with key ${i + 1}...`);
            await sendToGeminiStreaming(messages, attachments, apiKey, model);
            return; // Success, exit function
        } catch (error) {
            console.error(`Gemini API failed with key ${i + 1}:`, error);

            // If this is the last key, throw the error
            if (i === apiKeys.length - 1) {
                throw error;
            }
        }
    }
}

async function sendToGeminiStreamingRequest_DISABLED(messages, attachments, apiKey, model) {

    // Prepare conversation history
    const conversation = [];

    // Add custom prompt if exists
    if (settings.customPrompt.trim()) {
        conversation.push({
            role: 'user',
            parts: [{ text: settings.customPrompt }]
        });
        conversation.push({
            role: 'model',
            parts: [{ text: 'مفهوم، سأتبع هذه التعليمات في جميع ردودي.' }]
        });
    }

    // Convert messages to Gemini format
    messages.forEach(msg => {
        if (msg.role === 'user') {
            let content = msg.content;

            // Add file contents to message if any
            if (attachments && attachments.length > 0) {
                const fileContents = attachments
                    .filter(file => file.content)
                    .map(file => `\n\n--- محتوى الملف: ${file.name} ---\n${file.content}\n--- نهاية الملف ---`)
                    .join('');
                content += fileContents;
            }

            conversation.push({
                role: 'user',
                parts: [{ text: content }]
            });
        } else if (msg.role === 'assistant') {
            conversation.push({
                role: 'model',
                parts: [{ text: msg.content }]
            });
        }
    });

    const requestBody = {
        contents: conversation,
        generationConfig: {
            temperature: settings.temperature,
            maxOutputTokens: 4096,
        }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    let fullResponse = '';
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();

                if (trimmedLine && trimmedLine !== '[' && trimmedLine !== ']' && trimmedLine !== ',' && trimmedLine.length > 2) {
                    try {
                        // Remove trailing commas and brackets
                        let cleanLine = trimmedLine.replace(/,$/, '').replace(/^\[/, '').replace(/\]$/, '');

                        // Skip empty or invalid JSON
                        if (!cleanLine || cleanLine === '{' || cleanLine === '}') {
                            continue;
                        }

                        // Parse the JSON directly (Gemini streaming format)
                        const data = JSON.parse(cleanLine);
                        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                            const parts = data.candidates[0].content.parts;
                            for (const part of parts) {
                                if (part.text) {
                                    fullResponse += part.text;
                                    appendToStreamingMessage(part.text);
                                }
                            }
                        }
                    } catch (e) {
                        // Skip parsing errors silently unless it's a substantial chunk
                        if (trimmedLine.length > 10) {
                            console.debug('Skipping invalid JSON chunk:', trimmedLine.substring(0, 50));
                        }
                    }
                }
            }
        }

        // Process any remaining buffer
        if (buffer.trim() && buffer.trim().length > 2) {
            try {
                let cleanBuffer = buffer.trim().replace(/,$/, '').replace(/^\[/, '').replace(/\]$/, '');
                if (cleanBuffer && cleanBuffer !== '{' && cleanBuffer !== '}') {
                    const data = JSON.parse(cleanBuffer);
                    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                        const parts = data.candidates[0].content.parts;
                        for (const part of parts) {
                            if (part.text) {
                                fullResponse += part.text;
                                appendToStreamingMessage(part.text);
                            }
                        }
                    }
                }
            } catch (e) {
                // Silently ignore final buffer parsing errors
                console.debug('Could not parse final buffer:', buffer.substring(0, 50));
            }
        }
    } finally {
        reader.releaseLock();
    }

    // Complete the streaming
    appendToStreamingMessage('', true);

    // Add assistant message to conversation
    chats[currentChatId].messages.push({
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now()
    });
}

async function sendToOpenRouterSimple(messages, attachments) {
    const apiKeys = settings.openrouterApiKeys.filter(key => key.status === 'active').map(key => key.key);
    if (apiKeys.length === 0) {
        throw new Error('لا توجد مفاتيح OpenRouter API نشطة');
    }

    const apiKey = apiKeys[0];
    const model = settings.model;

    // Prepare messages for OpenRouter
    const formattedMessages = [];

    // Add custom prompt if exists
    if (settings.customPrompt.trim()) {
        formattedMessages.push({
            role: 'system',
            content: settings.customPrompt
        });
    }

    // Convert messages
    messages.forEach(msg => {
        if (msg.role === 'user') {
            let content = msg.content;

            // Add file contents if any
            if (attachments && attachments.length > 0) {
                const fileContents = attachments
                    .filter(file => file.content)
                    .map(file => `\n\n--- محتوى الملف: ${file.name} ---\n${file.content}\n--- نهاية الملف ---`)
                    .join('');
                content += fileContents;
            }

            formattedMessages.push({
                role: 'user',
                content: content
            });
        } else if (msg.role === 'assistant') {
            formattedMessages.push({
                role: 'assistant',
                content: msg.content
            });
        }
    });

    const requestBody = {
        model: model,
        messages: formattedMessages,
        temperature: settings.temperature,
        stream: true,
        max_tokens: 4096
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Zeus Chat'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    let fullResponse = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                            const text = parsed.choices[0].delta.content;
                            fullResponse += text;
                            appendToStreamingMessage(text);
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    // Complete the streaming
    appendToStreamingMessage('', true);

    // Add assistant message to conversation
    chats[currentChatId].messages.push({
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now()
    });
}

async function sendToCustomProviderSimple(messages, attachments, providerId) {
    const customProvider = settings.customProviders.find(p => p.id === providerId);
    if (!customProvider) {
        throw new Error('المزود المخصص غير موجود');
    }

    const apiKeys = (customProvider.apiKeys || []).filter(key => key.status === 'active').map(key => key.key);
    if (apiKeys.length === 0) {
        throw new Error(`لا توجد مفاتيح API نشطة للمزود ${customProvider.name}`);
    }

    // For now, fallback to non-streaming for custom providers
    // This can be extended based on the custom provider's API specifications
    const response = await sendToCustomProvider(messages, attachments, providerId);

    // Simulate streaming for custom providers
    const text = response;
    const words = text.split(' ');

    for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? ' ' : '');
        appendToStreamingMessage(word);
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
    }

    appendToStreamingMessage('', true);

    // Add assistant message to conversation
    chats[currentChatId].messages.push({
        role: 'assistant',
        content: text,
        timestamp: Date.now()
    });
}
*/

// Rest of the existing functions (chat management, UI functions, etc.)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    // التمرير الفوري للأسفل
    messagesArea.scrollTop = messagesArea.scrollHeight;

    // التمرير السلس للأسفل كنسخة احتياطية
    setTimeout(() => {
        messagesArea.scrollTo({
            top: messagesArea.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

function updateSendButton() {
    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const fileInput = document.getElementById('fileInput');

    const hasText = input.value.trim().length > 0;
    const hasFiles = fileInput.files.length > 0;

    sendButton.disabled = !hasText && !hasFiles;
}

// Chat management functions
async function startNewChat() {
    const chatId = Date.now().toString();
    currentChatId = chatId;
    const now = Date.now();
    chats[chatId] = {
        id: chatId,
        title: 'محادثة جديدة',
        messages: [],
        createdAt: now,
        updatedAt: now,
        order: now // Used for drag-and-drop reordering
    };

    document.getElementById('welcomeScreen').classList.remove('hidden');
    document.getElementById('messagesContainer').classList.add('hidden');
    document.getElementById('messagesArea').innerHTML = '';

    displayChatHistory();
    saveData();
}

// Drag and drop state
let draggedChatId = null;

function displayChatHistory() {
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.innerHTML = '';

    // Sort by the 'order' property, descending (higher order value = higher on the list)
    const sortedChats = Object.values(chats).sort((a, b) => b.order - a.order);

    if (sortedChats.length === 0) {
        chatHistory.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-comments text-2xl mb-2"></i>
                <p>لا توجد محادثات بعد</p>
                <p class="text-xs">ابدأ محادثة جديدة لرؤيتها هنا</p>
            </div>
        `;
        return;
    }

    sortedChats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `p-3 rounded-lg cursor-pointer transition-colors ${chat.id === currentChatId ? 'bg-zeus-accent text-white' : 'hover:bg-white/10 text-gray-300'}`;

        // Make item draggable
        chatItem.setAttribute('draggable', true);
        chatItem.setAttribute('data-chat-id', chat.id);

        const lastMessage = chat.messages[chat.messages.length - 1];
        const preview = lastMessage ? (lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')) : 'محادثة فارغة';

        chatItem.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0" id="chat-title-container-${chat.id}">
                    <h4 class="font-medium truncate">${escapeHtml(chat.title)}</h4>
                    <p class="text-sm opacity-70 truncate">${escapeHtml(preview)}</p>
                </div>
                <div class="flex items-center ml-2 space-x-1 space-x-reverse">
                    <button onclick="toggleEditChatTitle('${chat.id}', event)" class="p-1 rounded hover:bg-white/20 text-gray-300 hover:text-white transition-colors" title="تعديل الاسم">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="deleteChat('${chat.id}', event)" class="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors" title="حذف المحادثة">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;

        chatItem.onclick = (e) => {
            if (e.target.closest('button')) return;
            switchToChat(chat.id);
        };

        // Add drag and drop event listeners
        chatItem.addEventListener('dragstart', handleDragStart);
        chatItem.addEventListener('dragenter', handleDragEnter);
        chatItem.addEventListener('dragover', handleDragOver);
        chatItem.addEventListener('dragleave', handleDragLeave);
        chatItem.addEventListener('drop', handleDrop);
        chatItem.addEventListener('dragend', handleDragEnd);

        chatHistory.appendChild(chatItem);
    });
}

// --- Drag and Drop Handlers ---

function handleDragStart(e) {
    draggedChatId = this.getAttribute('data-chat-id');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedChatId);

    setTimeout(() => {
        this.classList.add('dragging');
    }, 0);
}

function handleDragEnter(e) {
    e.preventDefault();
    const dropTarget = this;
    if (dropTarget.getAttribute('data-chat-id') !== draggedChatId) {
        // Remove existing indicators before adding a new one
        document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());

        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';

        const rect = dropTarget.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;

        if (isAfter) {
            dropTarget.insertAdjacentElement('afterend', indicator);
        } else {
            dropTarget.insertAdjacentElement('beforebegin', indicator);
        }
    }
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
}

function handleDragLeave(e) {
    // This is to prevent the indicator from disappearing when moving between child elements
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory.contains(e.relatedTarget)) {
        document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const sourceChatId = e.dataTransfer.getData('text/plain');
    const dropIndicator = document.querySelector('.drop-indicator');

    if (!dropIndicator || !chats[sourceChatId]) {
        if(dropIndicator) dropIndicator.remove();
        return;
    }

    const nextSibling = dropIndicator.nextElementSibling;
    const prevSibling = dropIndicator.previousElementSibling;

    const orderBefore = nextSibling && nextSibling.hasAttribute('data-chat-id') ? chats[nextSibling.getAttribute('data-chat-id')].order : null;
    const orderAfter = prevSibling && prevSibling.hasAttribute('data-chat-id') ? chats[prevSibling.getAttribute('data-chat-id')].order : null;

    let newOrder;
    if (orderBefore === null && orderAfter !== null) {
        // Dropped at the end of the list
        newOrder = orderAfter - 1000;
    } else if (orderBefore !== null && orderAfter === null) {
        // Dropped at the beginning of the list
        newOrder = orderBefore + 1000;
    } else if (orderBefore !== null && orderAfter !== null) {
        // Dropped between two items
        newOrder = (orderBefore + orderAfter) / 2;
    } else {
        // List has only one item or is empty, no change needed
        dropIndicator.remove();
        return;
    }

    chats[sourceChatId].order = newOrder;
    saveData();

    // The dragend handler will remove the indicator and dragging class
    // Re-render to show the final correct order
    displayChatHistory();
}

function handleDragEnd(e) {
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
}

function switchToChat(chatId) {
    if (!chats[chatId]) return;

    currentChatId = chatId;
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('messagesContainer').classList.remove('hidden');

    displayMessages();
    displayChatHistory();
    closeSidebar();
}

function deleteChat(chatId, event) {
    if (event) event.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذه المحادثة؟')) {
        delete chats[chatId];

        if (currentChatId === chatId) {
            currentChatId = null;
            document.getElementById('welcomeScreen').classList.remove('hidden');
            document.getElementById('messagesContainer').classList.add('hidden');
        }

        displayChatHistory();
        saveData();
    }
}

function toggleEditChatTitle(chatId, event) {
    event.stopPropagation();
    const titleContainer = document.getElementById(`chat-title-container-${chatId}`);
    const chatItem = titleContainer.closest('.p-3');
    if (!titleContainer || !chatItem) return;

    const currentTitle = chats[chatId].title;

    // Preserve the preview text
    const previewText = chatItem.querySelector('p').textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'w-full bg-transparent text-white border-b border-white/50 focus:outline-none text-base font-medium';
    input.style.direction = 'rtl';
    input.onclick = (e) => e.stopPropagation();

    const saveAndUpdate = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            updateChatTitle(chatId, newTitle);
        } else {
            displayChatHistory(); // Restore if title is empty or unchanged
        }
    };

    input.onblur = saveAndUpdate;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveAndUpdate();
        } else if (e.key === 'Escape') {
            displayChatHistory();
        }
    };

    titleContainer.innerHTML = '';
    titleContainer.appendChild(input);

    // Re-add the preview paragraph
    const p = document.createElement('p');
    p.className = 'text-sm opacity-70 truncate';
    p.textContent = previewText;
    titleContainer.appendChild(p);

    input.focus();
    input.select();
}

function updateChatTitle(chatId, newTitle) {
    if (newTitle && newTitle.trim() !== '') {
        const now = Date.now();
        chats[chatId].title = newTitle.trim();
        chats[chatId].updatedAt = now;
        chats[chatId].order = now; // Bring to top on edit
        saveData();
    }
    displayChatHistory();
}

function displayMessages() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.innerHTML = '';

    if (!currentChatId || !chats[currentChatId]) return;

    chats[currentChatId].messages.forEach(message => {
        displayMessage(message);
    });

    scrollToBottom();
}

function displayMessage(message) {
    const messagesArea = document.getElementById('messagesArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-bubble message-${message.role}`;

    if (message.role === 'user') {
        let content = `<div class="message-content">${escapeHtml(message.content)}</div>`;

        // Add file cards if there are attachments
        if (message.attachments && message.attachments.length > 0) {
            const fileCards = message.attachments.map(file => createFileCard(file)).join('');
            content += fileCards;
        }

        messageDiv.innerHTML = content;
    } else {
        const renderedContent = marked.parse(message.content);
        messageDiv.innerHTML = `<div class="message-content">${renderedContent}</div>`;

        // Highlight code blocks
        messageDiv.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
            addCodeHeader(block.parentElement);
        });

        addMessageActions(messageDiv, message.content);
    }

    messagesArea.appendChild(messageDiv);
}

function addCodeHeader(preElement) {
    // Remove any existing header
    const existingHeader = preElement.querySelector('.code-header-new');
    if (existingHeader) {
        existingHeader.remove();
    }

    const codeElement = preElement.querySelector('code');
    if (!codeElement) return;

    // Detect language
    let language = 'نص';
    const className = codeElement.className;
    const languageMatch = className.match(/language-(\w+)/);
    if (languageMatch) {
        const lang = languageMatch[1].toLowerCase();
        const languageNames = {
            'javascript': 'JavaScript',
            'js': 'JavaScript',
            'python': 'Python',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'xml': 'XML',
            'sql': 'SQL',
            'bash': 'Bash',
            'shell': 'Shell'
        };
        language = languageNames[lang] || lang;
    }

    // Create header
    const header = document.createElement('div');
    header.className = 'code-header-new';
    header.innerHTML = `
        <span class="language-label">${language}</span>
        <button class="copy-button-new" onclick="copyCode(this)">
            <i class="fas fa-copy"></i>
            <span>نسخ</span>
        </button>
    `;

    // Insert header at the beginning of pre element
    preElement.insertBefore(header, preElement.firstChild);
}

function copyCode(button) {
    const pre = button.closest('pre');
    const code = pre.querySelector('code');
    const text = code.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const span = button.querySelector('span');
        const icon = button.querySelector('i');
        const originalText = span.textContent;
        const originalIcon = icon.className;

        span.textContent = 'تم النسخ!';
        icon.className = 'fas fa-check';

        setTimeout(() => {
            span.textContent = originalText;
            icon.className = originalIcon;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('فشل في نسخ الكود', 'error');
    });
}

function addMessageActions(messageElement, content) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML = `
        <button onclick="copyMessage(this)" class="p-1 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/10" data-tooltip="نسخ">
            <i class="fas fa-copy text-xs"></i>
        </button>
        <button onclick="regenerateMessage(this)" class="p-1 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/10" data-tooltip="إعادة توليد">
            <i class="fas fa-redo text-xs"></i>
        </button>
    `;

    messageElement.appendChild(actions);
    messageElement.setAttribute('data-content', content);
}

function copyMessage(button) {
    const messageElement = button.closest('.chat-bubble');
    const content = messageElement.getAttribute('data-content');

    navigator.clipboard.writeText(content).then(() => {
        showNotification('تم نسخ الرسالة', 'success');
    }).catch(err => {
        console.error('Failed to copy message:', err);
        showNotification('فشل في نسخ الرسالة', 'error');
    });
}

function regenerateMessage(button) {
    // This would require re-sending the last user message
    showNotification('ميزة إعادة التوليد ستكون متاحة قريباً', 'info');
}

// Settings and data management
function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
    loadSettingsUI();
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function loadSettingsUI() {
    // Load provider
    document.getElementById('providerSelect').value = settings.provider;

    // Load temperature
    document.getElementById('temperatureSlider').value = settings.temperature;
    document.getElementById('temperatureValue').textContent = settings.temperature;

    // Load custom prompt
    document.getElementById('customPromptInput').value = settings.customPrompt;

    // Load API key retry strategy
    document.getElementById('apiKeyRetryStrategySelect').value = settings.apiKeyRetryStrategy;

    // Load API keys
    renderGeminiApiKeys();
    renderOpenRouterApiKeys();

    // Load font size
    document.getElementById('fontSizeSlider').value = settings.fontSize;
    document.getElementById('fontSizeValue').textContent = `${settings.fontSize}px`;

    updateProviderUI();
    updateModelOptions();
}

function saveSettings() {
    // Save basic settings
    settings.provider = document.getElementById('providerSelect').value;
    settings.model = document.getElementById('modelSelect').value;
    settings.temperature = parseFloat(document.getElementById('temperatureSlider').value);
    settings.customPrompt = document.getElementById('customPromptInput').value;
    settings.apiKeyRetryStrategy = document.getElementById('apiKeyRetryStrategySelect').value;
    settings.fontSize = parseInt(document.getElementById('fontSizeSlider').value, 10);

    saveData();
    closeSettings();
    showNotification('تم حفظ الإعدادات بنجاح', 'success');
}

// API Keys management
function renderGeminiApiKeys() {
    const container = document.getElementById('geminiApiKeysContainer');
    container.innerHTML = '';

    if (settings.geminiApiKeys.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-4">
                <i class="fas fa-key text-2xl mb-2"></i>
                <p>لا توجد مفاتيح API بعد</p>
                <p class="text-xs">اضغط على "أضف مفتاحاً جديداً" لإضافة مفتاح API</p>
            </div>
        `;
        return;
    }

    settings.geminiApiKeys.forEach((apiKey, index) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'flex items-center space-x-3 space-x-reverse';
        keyDiv.innerHTML = `
            <div class="relative flex-1">
                <input type="password" value="${apiKey.key}" 
                    onchange="updateGeminiApiKey(${index}, this.value)"
                    id="geminiApiKeyInput-${index}"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-base pl-10 backdrop-blur-sm"
                    placeholder="أدخل مفتاح Gemini API">
                <button type="button" onclick="toggleGeminiApiKeyVisibility(${index})" 
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i id="geminiApiKeyToggleIcon-${index}" class="fas fa-eye"></i>
                </button>
            </div>
            <div class="flex items-center space-x-2 space-x-reverse">
                <span class="status-indicator ${apiKey.status === 'active' ? 'bg-green-500' : 'bg-red-500'} w-3 h-3 rounded-full"></span>
                <span class="text-xs text-gray-500 dark:text-gray-400">${apiKey.status === 'active' ? 'نشط' : 'معطل'}</span>
            </div>
            <button onclick="removeGeminiApiKey(${index})" 
                class="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                <i class="fas fa-trash text-sm"></i>
            </button>
        `;
        container.appendChild(keyDiv);
    });
}

function addGeminiApiKeyField() {
    settings.geminiApiKeys.push({
        key: '',
        status: 'active'
    });
    renderGeminiApiKeys();
}

function removeGeminiApiKey(index) {
    settings.geminiApiKeys.splice(index, 1);
    renderGeminiApiKeys();
}

function updateGeminiApiKey(index, value) {
    if (settings.geminiApiKeys[index]) {
        settings.geminiApiKeys[index].key = value;
    }
}

function toggleGeminiApiKeyVisibility(index) {
    const input = document.getElementById(`geminiApiKeyInput-${index}`);
    const icon = document.getElementById(`geminiApiKeyToggleIcon-${index}`);

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function renderOpenRouterApiKeys() {
    const container = document.getElementById('openrouterApiKeysContainer');
    container.innerHTML = '';

    if (settings.openrouterApiKeys.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-4">
                <i class="fas fa-key text-2xl mb-2"></i>
                <p>لا توجد مفاتيح API بعد</p>
                <p class="text-xs">اضغط على "أضف مفتاحاً جديداً" لإضافة مفتاح API</p>
            </div>
        `;
        return;
    }

    settings.openrouterApiKeys.forEach((apiKey, index) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'flex items-center space-x-3 space-x-reverse';
        keyDiv.innerHTML = `
            <div class="relative flex-1">
                <input type="password" value="${apiKey.key}" 
                    onchange="updateOpenRouterApiKey(${index}, this.value)"
                    id="openrouterApiKeyInput-${index}"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white text-base pl-10 backdrop-blur-sm"
                    placeholder="أدخل مفتاح OpenRouter API">
                <button type="button" onclick="toggleOpenRouterApiKeyVisibility(${index})" 
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i id="openrouterApiKeyToggleIcon-${index}" class="fas fa-eye"></i>
                </button>
            </div>
            <div class="flex items-center space-x-2 space-x-reverse">
                <span class="status-indicator ${apiKey.status === 'active' ? 'bg-green-500' : 'bg-red-500'} w-3 h-3 rounded-full"></span>
                <span class="text-xs text-gray-500 dark:text-gray-400">${apiKey.status === 'active' ? 'نشط' : 'معطل'}</span>
            </div>
            <button onclick="removeOpenRouterApiKey(${index})" 
                class="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                <i class="fas fa-trash text-sm"></i>
            </button>
        `;
        container.appendChild(keyDiv);
    });
}

function addOpenRouterApiKeyField() {
    settings.openrouterApiKeys.push({
        key: '',
        status: 'active'
    });
    renderOpenRouterApiKeys();
}

function removeOpenRouterApiKey(index) {
    settings.openrouterApiKeys.splice(index, 1);
    renderOpenRouterApiKeys();
}

function updateOpenRouterApiKey(index, value) {
    if (settings.openrouterApiKeys[index]) {
        settings.openrouterApiKeys[index].key = value;
    }
}

function toggleOpenRouterApiKeyVisibility(index) {
    const input = document.getElementById(`openrouterApiKeyInput-${index}`);
    const icon = document.getElementById(`openrouterApiKeyToggleIcon-${index}`);

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// UI functions
function openSidebar() {
    document.getElementById('sidebar').classList.remove('translate-x-full');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.add('translate-x-full');
}

function toggleDarkMode() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');

    body.classList.toggle('dark');

    if (body.classList.contains('dark')) {
        themeIcon.className = 'fas fa-sun text-lg';
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.className = 'fas fa-moon text-lg';
        localStorage.setItem('theme', 'light');
    }
}

function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('themeIcon');

    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark');
        themeIcon.className = 'fas fa-sun text-lg';
    } else {
        document.body.classList.remove('dark');
        themeIcon.className = 'fas fa-moon text-lg';
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');

    const notification = document.createElement('div');
    notification.className = `notification ${type} animate-fade-in pointer-events-auto`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} ml-2"></i>
            <span>${message}</span>
        </div>
    `;

    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Data persistence
function saveData() {
    try {
        localStorage.setItem('zeusChats', JSON.stringify(chats));
        localStorage.setItem('zeusSettings', JSON.stringify(settings));
        localStorage.setItem('zeusCurrentChatId', currentChatId || '');
    } catch (error) {
        console.error('Error saving data:', error);
        showNotification('خطأ في حفظ البيانات', 'error');
    }
}

function loadData() {
    try {
        const savedChats = localStorage.getItem('zeusChats');
        const savedSettings = localStorage.getItem('zeusSettings');
        const savedCurrentChatId = localStorage.getItem('zeusCurrentChatId');

        if (savedChats) {
            chats = JSON.parse(savedChats);
            // Ensure all chats have an 'order' property for drag-and-drop
            Object.values(chats).forEach(chat => {
                if (chat.order === undefined) {
                    // Use updatedAt for backward compatibility, ensuring newest are on top
                    chat.order = chat.updatedAt;
                }
            });
        }

        if (savedSettings) {
            const loadedSettings = JSON.parse(savedSettings);
            settings = { ...settings, ...loadedSettings };
            // Apply loaded font size on startup
            if (settings.fontSize) {
                updateFontSize(settings.fontSize);
            }
        }

        if (savedCurrentChatId && chats[savedCurrentChatId]) {
            currentChatId = savedCurrentChatId;
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('خطأ في تحميل البيانات', 'error');
    }
}

// Legacy functions for backward compatibility (these may not be used with new file card system)
async function sendToCustomProvider(messages, attachments, providerId) {
    const customProvider = settings.customProviders.find(p => p.id === providerId);
    if (!customProvider) {
        throw new Error('المزود المخصص غير موجود');
    }

    const apiKeys = (customProvider.apiKeys || []).filter(key => key.status === 'active').map(key => key.key);
    if (apiKeys.length === 0) {
        throw new Error(`لا توجد مفاتيح API نشطة للمزود ${customProvider.name}`);
    }

    // This is a basic implementation - extend based on your custom provider's API
    const apiKey = apiKeys[0];
    const baseUrl = customProvider.baseUrl || 'https://api.openai.com/v1';

    // Prepare messages
    const formattedMessages = [];

    if (settings.customPrompt.trim()) {
        formattedMessages.push({
            role: 'system',
            content: settings.customPrompt
        });
    }

    messages.forEach(msg => {
        if (msg.role === 'user') {
            let content = msg.content;

            if (attachments && attachments.length > 0) {
                const fileContents = attachments
                    .filter(file => file.content)
                    .map(file => `\n\n--- محتوى الملف: ${file.name} ---\n${file.content}\n--- نهاية الملف ---`)
                    .join('');
                content += fileContents;
            }

            formattedMessages.push({
                role: 'user',
                content: content
            });
        } else if (msg.role === 'assistant') {
            formattedMessages.push({
                role: 'assistant',
                content: msg.content
            });
        }
    });

    const requestBody = {
        model: settings.model,
        messages: formattedMessages,
        temperature: settings.temperature,
        max_tokens: 4096
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Custom provider API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}


async function sendToGeminiStreaming(messages, attachments, apiKey, model) {
    // 1. إعداد هيكل المحادثة
    const conversation = [];

    // إضافة البرومبت المخصص إذا كان موجودًا
    if (settings.customPrompt.trim()) {
        conversation.push({ role: 'user', parts: [{ text: settings.customPrompt }] });
        conversation.push({ role: 'model', parts: [{ text: 'مفهوم، سأتبع هذه التعليمات.' }] });
    }

    // 2. إضافة الرسائل السابقة (كل الرسائل ما عدا الأخيرة)
    // هذا يحافظ على سياق المحادثة
    const previousMessages = messages.slice(0, -1);
    previousMessages.forEach(msg => {
        // نتجاهل المرفقات في الرسائل القديمة للتبسيط وإرسالها كنص فقط
        if (msg.role === 'user') {
            conversation.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant') {
            conversation.push({ role: 'model', parts: [{ text: msg.content }] });
        }
    });

    // 3. ✨ معالجة الرسالة الأخيرة مع مرفقاتها (هذا هو الجزء الرئيسي)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
        const userParts = [];

        // أضف نص الرسالة أولاً
        if (lastMessage.content) {
            userParts.push({ text: lastMessage.content });
        }

        // أضف المرفقات (نصوص وصور) كأجزاء منفصلة
        if (attachments && attachments.length > 0) {
            attachments.forEach(file => {
                if (file.dataType === 'image' && file.content) {
                    // هذا هو الجزء الخاص بالصور
                    userParts.push({
                        inline_data: {
                            mime_type: file.mimeType,
                            data: file.content // بيانات Base64
                        }
                    });
                } else if (file.dataType === 'text' && file.content) {
                    // هذا الجزء للملفات النصية (نضيفها كنص إضافي)
                    const fileText = `\n\n--- محتوى الملف: ${file.name} ---\n${file.content}\n--- نهاية الملف ---`;
                    userParts.push({ text: fileText });
                }
            });
        }

        // Gemini يتطلب وجود جزء نصي واحد على الأقل في الطلب
        // إذا كانت الرسالة تحتوي على صور فقط بدون نص، نضيف نصًا افتراضيًا
        if (userParts.length > 0 && userParts.every(p => !p.text)) {
            userParts.unshift({ text: "انظر إلى الصور المرفقة:" });
        }

        // أضف الرسالة الأخيرة المجمعة إلى المحادثة
        if (userParts.length > 0) {
            conversation.push({ role: 'user', parts: userParts });
        }
    }

    // 4. إعداد الطلب النهائي للـ API
    const requestBody = {
        contents: conversation,
        generationConfig: {
            temperature: settings.temperature,
            maxOutputTokens: 4096,
        }
    };

    // 5. إرسال الطلب وقراءة الاستجابة (هذا الجزء يبقى كما هو)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody )
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error Response:', errorText); // طباعة الخطأ للمساعدة في التصحيح
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    try {
                        const jsonString = line.replace('data: ', '');
                        const json = JSON.parse(jsonString);
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        if (text) {
                            appendToStreamingMessage(text);
                        }
                    } catch (e) {
                        console.debug('Skipping invalid JSON chunk:', line);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    appendToStreamingMessage('', true);
}