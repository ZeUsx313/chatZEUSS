// ✨ الرابط الأساسي والثابت للخادم الخلفي على Railway
const API_BASE_URL = 'https://chatzeus-production.up.railway.app';

// ===============================================
// المتغيرات العامة
// ===============================================
let currentUser = null;
let currentChatId = null;
let chats = {};

// ✨ 1. الإعدادات الافتراضية الثابتة (لا تتغير أبدًا) ✨
const defaultSettings = {
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  temperature: 0.7,
  geminiApiKeys: [],
  openrouterApiKeys: [],
  customProviders: [],
  customModels: [],
  customPrompt: '',
  apiKeyRetryStrategy: 'sequential',
  fontSize: 18,
  theme: 'blue' // 👈 ثيم الواجهة: blue | black | light
};

// ✨ 2. الإعدادات الحالية التي ستتغير (تبدأ كنسخة من الافتراضية) ✨
let settings = { ...defaultSettings };

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
    // ✨ معالجة التوكن عند العودة من صفحة جوجل ✨
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        console.log("Token found in URL, saving to localStorage.");
        localStorage.setItem('authToken', token);
        // تنظيف الرابط من التوكن لأسباب أمنية
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    initializeTheme();
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

    // ✨ التحقق من حالة المستخدم ✨
    checkUserStatus();
// ===== ثبات الشاشة على iOS عند فتح الكيبورد =====
try {
  const root = document.documentElement;
  const mainShell = document.querySelector('main') || document.body;
  function applyViewportFix() {
    if (window.visualViewport) {
      const vh = window.visualViewport.height;
      root.style.setProperty('--vhpx', `${vh}px`);
      // إن أردت استخدامه في CSS: height: var(--vhpx);
    }
  }
  applyViewportFix();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', applyViewportFix);
    window.visualViewport.addEventListener('scroll', applyViewportFix);
  }

const input = document.getElementById('messageInput');
const area  = document.getElementById('messagesArea');

function scrollToBottom(force = false) {
  if (!area) return;
  const nearBottom = (area.scrollHeight - area.scrollTop - area.clientHeight) < 60;
  if (force || nearBottom) {
    area.scrollTop = area.scrollHeight;
  }
}

if (input && area) {
  // عند التركيز: انزل لآخر الرسائل، وثبّت الشاشة (لا تُحرّك window)
  input.addEventListener('focus', () => {
    setTimeout(() => scrollToBottom(true), 50);
  });

  // أثناء الكتابة أو تمدد الـ textarea
  input.addEventListener('input', () => {
    // إعادة ضبط ارتفاع الـ textarea لديك موجودة؛ بعدها ننزل لأسفل
    setTimeout(() => scrollToBottom(), 0);
  });
}

// تحدّث ارتفاع الشاشة ديناميكياً مع الكيبورد (موجود لديك، نضيف عليه تمرير للأسفل)
function applyViewportFix() {
  if (window.visualViewport) {
    const vh = window.visualViewport.height;
    document.documentElement.style.setProperty('--vhpx', `${vh}px`);
    scrollToBottom(); // حافظ على الرؤية أسفل عند تغيّر الارتفاع
  }
}
applyViewportFix();
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applyViewportFix);
  window.visualViewport.addEventListener('scroll', applyViewportFix);
}
} catch (_) {}

// ===== خلفية زيوس =====
const bgCanvas = document.getElementById('bgCanvas');
const bgSelect = document.getElementById('bgStyleSelect');

function applyBg(style) {
  if (!bgCanvas) return;
  bgCanvas.classList.remove('bg-calm','bg-storm','flash');
  bgCanvas.classList.add(style === 'storm' ? 'bg-storm' : 'bg-calm');
  localStorage.setItem('bgStyle', style);
}

// تحميل الخيار المحفوظ
applyBg(localStorage.getItem('bgStyle') || 'calm');

// من الإعدادات
if (bgSelect) {
  bgSelect.value = localStorage.getItem('bgStyle') || 'calm';
  bgSelect.addEventListener('change', e => applyBg(e.target.value));
}

// ومضات برق خفيفة عند وصول رسالة جديدة من المساعد
function zeusFlash() {
  if (!bgCanvas || !bgCanvas.classList.contains('bg-storm')) return;
  bgCanvas.classList.add('flash');
  setTimeout(() => bgCanvas.classList.remove('flash'), 1800);
}
});  // نهاية DOMContentLoaded

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
    const token = localStorage.getItem('authToken');
    const fileData = [];

    for (const file of files) {
        // 1) نجمع معلومات أساسية
        const info = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };

        // 2) نحدد النوع لتمرير المحتوى إلى /api/chat فقط
        const textExt = ['txt','js','html','css','json','xml','md','py','java','cpp','c','cs','php','rb','sql','yaml','yml','csv','log'];
        const imgExt  = ['jpg','jpeg','png','gif','webp','bmp'];
        const ext = (file.name.split('.').pop() || '').toLowerCase();

        try {
            if (textExt.includes(ext)) {
                info.dataType = 'text';
                info.content  = await readFileAsText(file);
            } else if (imgExt.includes(ext) || file.type.startsWith('image/')) {
                info.dataType = 'image';
                info.mimeType = file.type;
                info.content  = await readFileAsBase64(file);
            } else {
                // أنواع أخرى: نرسلها كما هي للذكاء كنص فارغ فقط
                info.dataType = 'binary';
            }
        } catch (e) {
            console.error('Error reading file for AI:', e);
        }

        // 3) نرفع النسخة الأصلية إلى الخادم للحفظ الدائم (FormData)
        try {
            const form = new FormData();
            form.append('file', file, file.name);

            const uploadRes = await fetch(`${API_BASE_URL}/api/files`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: form
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`فشل رفع الملف: ${uploadRes.status} - ${errText}`);
            }

            const uploaded = await uploadRes.json();
            // المتوقع من الخادم: { fileId, fileUrl, originalName, mimeType, size }
            info.fileId  = uploaded.fileId || uploaded._id || null;
            info.fileUrl = uploaded.fileUrl || null;

        } catch (e) {
            console.error('Upload error:', e);
            showNotification(`تعذر رفع "${file.name}" للحفظ الدائم`, 'error');
        }

        fileData.push(info);
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
        // ✨✨✨ التحقق من حجم الملف (5 ميجابايت) ✨✨✨
        if (file.size > 5 * 1024 * 1024) {
            return reject(new Error('حجم الملف كبير جدًا. الحد الأقصى هو 5 ميجابايت.'));
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
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
// ✨ الجديد: ثبت المحادثة التي بدأ فيها البث
    streamingState.chatId = currentChatId;

// زر الإرسال يتحول فوراً إلى "إيقاف"
    updateSendButton();

    return messageId;
}

function appendToStreamingMessage(text, isComplete = false) {
    if (!streamingState.isStreaming) return;

    // نجمع النص دائمًا
    streamingState.currentText += text;

    // إذا لم يكن لدينا عنصر DOM (مثلاً لأننا بدّلنا المحادثة)
    // ونعود الآن إلى نفس المحادثة التي يجري فيها البث،
    // نعيد إنشاء الفقاعة وربط العنصر مرة أخرى.
    if (!streamingState.streamingElement) {
        const weAreOnTheStreamingChat =
            currentChatId && streamingState.chatId && currentChatId === streamingState.chatId;

        if (weAreOnTheStreamingChat) {
            // إعادة إرفاق فقاعة البث في هذه المحادثة
            const messageId = streamingState.currentMessageId;
            const messagesArea = document.getElementById('messagesArea');

            // أنشئ غلاف الرسالة يدويًا (نسخة مبسطة من createStreamingMessage بدون إعادة ضبط الحالة)
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-bubble message-assistant streaming-message`;
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
            streamingState.streamingElement = document.getElementById(`content-${messageId}`);
        }
    }

    // إن لم يتوفر عنصر بعد (لأننا في محادثة أخرى)، نكتفي بتجميع النص ونؤجل العرض
    if (!streamingState.streamingElement) {
        if (isComplete) completeStreamingMessage();
        return;
    }

    // الآن نحدّث الـ DOM كالمعتاد
    const cursor = streamingState.streamingElement.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();
    const renderedContent = marked.parse(streamingState.currentText);
    streamingState.streamingElement.innerHTML = renderedContent;

    if (!isComplete) {
        const newCursor = document.createElement('span');
        newCursor.className = 'streaming-cursor';
        streamingState.streamingElement.appendChild(newCursor);
    }

    streamingState.streamingElement.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
        addCodeHeader(block.parentElement);
    });

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
// احفظ الرسالة داخل المحادثة التي بدأ فيها البث
const targetChatId = streamingState.chatId; // 👈 هذا هو الأهم
if (targetChatId && chats[targetChatId] && streamingState.currentText) {
    const now = Date.now();
    chats[targetChatId].messages.push({
        role: 'assistant',
        content: streamingState.currentText,
        timestamp: now
    });
    chats[targetChatId].updatedAt = now;
    chats[targetChatId].order = now;
}

// إعادة ضبط حالة البث
streamingState.isStreaming = false;
streamingState.currentMessageId = null;
streamingState.streamingElement = null;
streamingState.currentText = '';
streamingState.streamController = null;
streamingState.chatId = null;

// احفظ المحادثة الصحيحة في الخادم (تمرير المعرّف)
saveCurrentChat(targetChatId);

scrollToBottom();

}

function smoothScrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.scrollTo({
        top: messagesArea.scrollHeight,
        behavior: 'smooth'
    });
}

async function sendMessage() {

    if (streamingState.isStreaming) { 
        cancelStreaming('new-send'); 
        return; 
    }

    // ⚠️ في حال تغيّر المعرّف بعد حفظ سابق
    if (currentChatId && !chats[currentChatId]) {
        const latest = Object.values(chats).sort((a,b)=>(b.order||0)-(a.order||0))[0];
        currentChatId = latest ? latest._id : null;
    }

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

        // ✨✨✨ الميزة الجديدة تبدأ هنا ✨✨✨
        // 1. تحقق إذا كانت هذه هي الرسالة الأولى في المحادثة الحالية
        if (chats[currentChatId] && chats[currentChatId].messages.length === 0 && message) {
            // 2. إذا كانت كذلك، قم بتحديث عنوان المحادثة
            chats[currentChatId].title = message;
            // 3. قم بتحديث قائمة المحادثات فورًا لإظهار الاسم الجديد
            displayChatHistory();
        }
        // ✨✨✨ الميزة الجديدة تنتهي هنا ✨✨✨

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
        type: file.type,
        fileId: file.fileId || null,
        fileUrl: file.fileUrl || null
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
    // ✨ الحل النهائي: بناء حمولة (payload) سليمة دائمًا ✨
    const payload = {
        chatHistory: chatHistory,
        attachments: attachments.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            content: file.content,
            dataType: file.dataType,
            mimeType: file.mimeType
        })),
        // نستخدم كائن الإعدادات "settings" العام بالكامل
        // هذا يضمن أن كل الخصائص (مثل customProviders) تُرسل دائمًا، حتى لو كانت مصفوفات فارغة
        // وهذا يمنع حدوث خطأ 'undefined' في الخادم.
        settings: settings 
    };

    // 2. استدعاء الدالة التي تتصل بالخادم
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
    const token = localStorage.getItem('authToken');

    // 1) إنشاء المتحكّم وربطه بحالة البث
    const controller = new AbortController();
    streamingState.streamController = controller;

    // 2) الطلب مع signal للإلغاء الفوري
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server Error:', response.status, errorText);
      throw new Error(`خطأ من الخادم: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    try {
      while (true) {
        const { done, value } = await reader.read(); // سيُرمى AbortError عند الإلغاء
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        appendToStreamingMessage(chunk);
      }

      // اكتمال طبيعي
      appendToStreamingMessage('', true);

    } catch (error) {
      if (error.name === 'AbortError') {
        // تم الإلغاء: لا نرمي خطأ، أوقفنا البث بالفعل في cancelStreaming()
        console.debug('Streaming aborted by user.');
        return;
      }
      throw error;

    } finally {
      // تنظيف المقبض - لا تغيّر isStreaming هنا (تُدار في append/cancel)
      streamingState.streamController = null;
    }

  } catch (error) {
    // أخطاء شبكة/خادم
    console.error('Fetch error:', error);
    if (error.name !== 'AbortError') {
      appendToStreamingMessage(`\n\n❌ حدث خطأ أثناء الاتصال بالخادم: ${error.message}`, true);
    }
    throw error;
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

  if (streamingState.isStreaming) {
    // أثناء البث: الزر يصبح "إيقاف"
    sendButton.disabled = false;                       // يجب أن يبقى قابلاً للنقر لإيقاف البث
    sendButton.onclick = () => cancelStreaming('button');
    sendButton.innerHTML = '<i class="fas fa-stop"></i>';
    sendButton.classList.remove('bg-zeus-accent', 'hover:bg-zeus-accent-hover');
    sendButton.classList.add('bg-red-600', 'hover:bg-red-700');
  } else {
    // وضع عادي: الزر يعود "إرسال"
    sendButton.disabled = !hasText && !hasFiles;
    sendButton.onclick = () => sendMessage();
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    sendButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    sendButton.classList.add('bg-zeus-accent', 'hover:bg-zeus-accent-hover');
  }
}

// ==== إلغاء البث الحالي ====
function cancelStreaming(reason = 'user') {
  if (!streamingState.isStreaming) return;

  try {
    if (streamingState.streamController) {
      streamingState.streamController.abort(); // يقطع fetch فوراً
    }
  } catch (_) {}

  // إنهاء بصري أنيق مع حفظ ما وصلنا إليه
  appendToStreamingMessage('\n\n⏹️ تم إيقاف التوليد.', true);

  // تحديث الحالة والزر
  streamingState.isStreaming = false;
  streamingState.streamController = null;
  updateSendButton();

  // إشعار اختياري
  showNotification('تم إيقاف التوليد', 'info');
}

// إلغاء عند إغلاق/تحديث الصفحة
window.addEventListener('beforeunload', () => {
  if (streamingState.isStreaming && streamingState.streamController) {
    streamingState.streamController.abort();
  }
});

// اختصار لوحة المفاتيح: Escape يوقف البث
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && streamingState.isStreaming) {
    cancelStreaming('escape');
  }
});

// Chat management functions
async function startNewChat() {
    const chatId = Date.now().toString();
    currentChatId = chatId;
    const now = Date.now();
    chats[chatId] = {
        _id: chatId,
        title: 'محادثة جديدة',
        messages: [],
        createdAt: now,
        updatedAt: now,
        order: now,
        isTemporary: true         // ✨ تمييزها كمحادثة غير محفوظة بعد
    };

    document.getElementById('welcomeScreen').classList.remove('hidden');
    document.getElementById('messagesContainer').classList.add('hidden');
    document.getElementById('messagesArea').innerHTML = '';

    displayChatHistory();
}

// Drag and drop state
let draggedChatId = null;

function displayChatHistory() {
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.innerHTML = '';

    const sortedChats = Object.values(chats).sort((a, b) => (b.order || 0) - (a.order || 0));

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
        if (!chat._id) return; 

        const chatItem = document.createElement('div');
        chatItem.className = `p-3 rounded-lg cursor-pointer transition-colors ${chat._id === currentChatId ? 'bg-zeus-accent text-white' : 'hover:bg-white/10 text-gray-300'}`;

        chatItem.setAttribute('draggable', true);
        chatItem.setAttribute('data-chat-id', chat._id);

        const lastMessage = chat.messages[chat.messages.length - 1];
        const preview = lastMessage ? (lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')) : 'محادثة فارغة';

        // نسخة نظيفة تمامًا
        chatItem.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0" id="chat-title-container-${chat._id}">
                    <h4 class="font-medium truncate">${escapeHtml(chat.title)}</h4>
                    <p class="text-sm opacity-70 truncate">${escapeHtml(preview)}</p>
                </div>
                <div class="flex items-center ml-2 space-x-1 space-x-reverse">
                    <button onclick="toggleEditChatTitle('${chat._id}', event)" class="p-1 rounded hover:bg-white/20 text-gray-300 hover:text-white transition-colors" title="تعديل الاسم">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="deleteChat('${chat._id}', event)" class="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors" title="حذف المحادثة">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;

        chatItem.onclick = (e) => {
            if (e.target.closest('button')) return;
            switchToChat(chat._id);
        };

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

    // 👈 لا نُلغي البث هنا، نسمح له بالعمل في الخلفية
    currentChatId = chatId;
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('messagesContainer').classList.remove('hidden');

    displayMessages();
    displayChatHistory();
    closeSidebar();
}

// مساعد بسيط للتحقق من ObjectId
function isValidObjectId(id) {
    return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

// تنظيف المحادثة قبل الإرسال للخادم
function sanitizeChatForSave(chat) {
  const safeMessages = (chat.messages || []).map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : '',
    timestamp: m.timestamp || Date.now(),
    // نحفظ المراجع فقط (بدون content/base64)
    attachments: (m.attachments || []).map(a => ({
      name: a.name,
      type: a.type,
      size: a.size,
      fileId: a.fileId || null,
      fileUrl: a.fileUrl || null
    }))
  }));

  return {
    _id: chat._id,
    title: chat.title || 'محادثة',
    messages: safeMessages,
    createdAt: chat.createdAt || Date.now(),
    updatedAt: Date.now(),
    order: chat.order || Date.now()
  };
}

async function saveCurrentChat(chatIdParam = currentChatId) {
    if (!chatIdParam || !chats[chatIdParam]) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        // ✨ تنظيف قبل الحفظ
        const payload = sanitizeChatForSave(chats[chatIdParam]);

        const response = await fetch(`${API_BASE_URL}/api/chats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // ✨ التقط رسالة الخادم الحقيقية (JSON أو نص)
            let serverMsg = 'Failed to save chat to the database.';
            try {
                const txt = await response.text();
                serverMsg = txt || serverMsg;
            } catch (_) {}
            throw new Error(serverMsg);
        }

        const savedChat = await response.json();

        // خزّن النسخة العائدة من الخادم تحت الـ _id الحقيقي
        chats[savedChat._id] = { ...savedChat, isTemporary: false };

        // إن كان الـ chatIdParam مؤقّتًا (ليس ObjectId) احذفه
        const wasTemp = !isValidObjectId(chatIdParam);
        if (wasTemp && chatIdParam !== savedChat._id) {
            delete chats[chatIdParam];
        }

        // تحديث المعرّفات إن كنا على نفس المحادثة/نبثّ فيها
        if (currentChatId === chatIdParam) currentChatId = savedChat._id;
        if (streamingState.chatId === chatIdParam) streamingState.chatId = savedChat._id;

        console.log('Chat saved successfully to DB:', savedChat._id);
        displayChatHistory();

    } catch (error) {
        console.error('Error saving chat:', error);
        // ✨ أظهر رسالة الخادم بدل النص العام
        showNotification(`حدث خطأ أثناء حفظ المحادثة: ${error.message}`, 'error');
    }
}

async function deleteChat(chatId, event) {
    if (event) event.stopPropagation();

    if (!chats[chatId]) return;

    if (confirm('هل أنت متأكد من حذف هذه المحادثة؟')) {
        const token = localStorage.getItem('authToken');

        // 1) إذا كانت المحادثة مؤقتة محليًا (أو المعرّف ليس ObjectId) نحذفها محليًا فقط
        const temp = chats[chatId].isTemporary === true || !isValidObjectId(chatId);
        if (temp || !token) {
            delete chats[chatId];
            if (currentChatId === chatId) {
                currentChatId = null;
                document.getElementById('welcomeScreen').classList.remove('hidden');
                document.getElementById('messagesContainer').classList.add('hidden');
            }
            displayChatHistory();
            showNotification('تم حذف المحادثة محليًا.', 'success');
            return;
        }

        // 2) محادثة محفوظة فعلًا → احذف من الخادم أولًا
        try {
            const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('فشل حذف المحادثة من الخادم.');

            delete chats[chatId];

            if (currentChatId === chatId) {
                currentChatId = null;
                document.getElementById('welcomeScreen').classList.remove('hidden');
                document.getElementById('messagesContainer').classList.add('hidden');
            }

            displayChatHistory();
            showNotification('تم حذف المحادثة بنجاح.', 'success');

        } catch (error) {
            console.error('Error deleting chat:', error);
            showNotification(error.message, 'error');
        }
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

    // 👇 هنا نضع الكود الجديد من الخطوة 6
    if (streamingState.isStreaming && streamingState.chatId === currentChatId) {
        // اربط عنصر العرض مرة أخرى إن لم يكن موجودًا
        if (!document.getElementById(`message-${streamingState.currentMessageId}`)) {
            const messageId = streamingState.currentMessageId;
            const messagesArea = document.getElementById('messagesArea');

            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-bubble message-assistant streaming-message`;
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
            streamingState.streamingElement = document.getElementById(`content-${messageId}`);

            // أعرض ما جمعناه حتى الآن
            const rendered = marked.parse(streamingState.currentText || '');
            streamingState.streamingElement.innerHTML = rendered;
            const cursor = document.createElement('span');
            cursor.className = 'streaming-cursor';
            streamingState.streamingElement.appendChild(cursor);

            // تمييز الأكواد
            streamingState.streamingElement.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
                addCodeHeader(block.parentElement);
            });

            smoothScrollToBottom();
        }
    }
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
    onOpenSettingsModal();
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

// Load theme
const themeSel = document.getElementById('themeSelect');
if (themeSel) themeSel.value = settings.theme || 'blue';

// Load custom prompt (قد لا يكون موجوداً في HTML)
const cpi = document.getElementById('customPromptInput');
if (cpi) cpi.value = settings.customPrompt || '';

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

// ✨✨✨ الدالة المفقودة التي تصلح زر الحفظ ✨✨✨
async function saveSettings() {
  settings.provider = document.getElementById('providerSelect').value;
  settings.model = document.getElementById('modelSelect').value;
  settings.temperature = parseFloat(document.getElementById('temperatureSlider').value);
  // عنصر قد لا يكون موجودًا:
  const cpi = document.getElementById('customPromptInput');
  settings.customPrompt = cpi ? cpi.value : (settings.customPrompt || '');
  settings.apiKeyRetryStrategy = document.getElementById('apiKeyRetryStrategySelect').value;
  settings.fontSize = parseInt(document.getElementById('fontSizeSlider').value, 10);

  // الثيم:
  const themeSel = document.getElementById('themeSelect');
  if (themeSel) {
    settings.theme = themeSel.value;
    setTheme(settings.theme); // طبّقه فورًا
  }

  await saveSettingsToDB();
  closeSettings();
}

async function saveSettingsToDB() {
    if (!currentUser) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            const errorData = await response.json();
            // استخدم رسالة الخطأ من الخادم إذا كانت موجودة
            throw new Error(errorData.message || `فشل الحفظ: ${response.statusText}`);
        }

        const savedSettings = await response.json();
        settings = savedSettings;
        console.log('Settings saved successfully to DB.');
        showNotification('تم حفظ الإعدادات بنجاح', 'success'); // <-- انقل الإشعار إلى هنا

    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification(`خطأ: ${error.message}`, 'error');
    }
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

function setTheme(theme) {
  const body = document.body;
  body.classList.remove('theme-blue', 'theme-black', 'theme-light');
  if (theme === 'light') {
    body.classList.remove('dark');
  } else {
    body.classList.add('dark'); // لاستفادة dark: من Tailwind
  }
  body.classList.add(`theme-${theme}`);
  localStorage.setItem('themeV2', theme);
}

function initializeTheme() {
  const saved = (settings && settings.theme) || localStorage.getItem('themeV2') || 'blue';
  setTheme(saved);
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = saved;
}

function toggleDarkMode() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon'); // قد يكون غير موجود الآن

    body.classList.toggle('dark');

    const isDark = body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // تحمّل عدم وجود أيقونة في الرأس (لأننا نقلنا التحكم داخل منيو الحساب)
    if (themeIcon) {
        themeIcon.className = isDark ? 'fas fa-sun text-lg' : 'fas fa-moon text-lg';
    }
}

function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('themeIcon'); // قد لا يوجد

    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        if (themeIcon) themeIcon.className = 'fas fa-sun text-lg';
    } else if (savedTheme === 'light') {
        document.body.classList.remove('dark');
        if (themeIcon) themeIcon.className = 'fas fa-moon text-lg';
    } else {
        // الوضع الافتراضي: دع المتصفح يقرر، ولا تلمس الأيقونة إن لم تكن موجودة
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

// ===============================================
// نظام تسجيل الدخول والخروج
// ===============================================


async function checkUserStatus() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log("No auth token found. User is logged out.");
        currentUser = null;
        settings = { ...defaultSettings };
        updateUserDisplay();
        displayChatHistory();
        return;
    }

    try {
        // ✨ الخطوة 1: التحقق من هوية المستخدم
        const userResponse = await fetch(`${API_BASE_URL}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userResponse.ok) throw new Error('Invalid or expired token');
        const userData = await userResponse.json();

        // ✨ الخطوة 2: تحديث الواجهة فورًا بالمعلومات الأساسية للمستخدم
        currentUser = userData.user;
updateUserDisplay();
renderAccountInfo(); // 👈 تحديث تبويب "الحساب" // <--- هذا هو السحر! سيُظهر الصورة والاسم فورًا!

        // ✨ الخطوة 3: الآن، قم بجلب باقي البيانات (المحادثات والإعدادات)
        const dataResponse = await fetch(`${API_BASE_URL}/api/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!dataResponse.ok) {
            // حتى لو فشل هذا الطلب، سيبقى المستخدم مسجلاً دخوله
            showNotification('تم تسجيل الدخول، لكن فشل جلب البيانات.', 'error');
            throw new Error('Failed to fetch user data');
        }
        const data = await dataResponse.json();

        // ✨ الخطوة 4: دمج البيانات وتحديث باقي الواجهة
        chats = data.chats.reduce((acc, chat) => { acc[chat._id] = chat; return acc; }, {});
        settings = { ...defaultSettings, ...data.settings };

        // تحديث واجهة الإعدادات والمحادثات بالترتيب الصحيح
        updateCustomProviders();
        updateProviderSelect();
        displayChatHistory();
        loadSettingsUI();

        if (Object.keys(chats).length > 0) {
            currentChatId = Object.values(chats).sort((a, b) => (b.order || 0) - (a.order || 0))[0]._id;
            switchToChat(currentChatId);
        }

    } catch (error) {
        console.error("Check user status process failed:", error.message);
        // إذا فشلت أي خطوة بعد تعيين المستخدم، لا تسجل خروجه بالكامل
        // هذا يضمن بقاء الصورة والاسم ظاهرين حتى لو فشل جلب البيانات
        if (!currentUser) {
             localStorage.removeItem('authToken');
             chats = {};
             settings = { ...defaultSettings };
             updateUserDisplay();
             displayChatHistory();
        }
    }
}

function updateUserDisplay() {
    renderUserMenu(currentUser);
}

/**
 * تبدأ عملية تسجيل الدخول.
 */
function loginWithGoogle() {
    showNotification('جارٍ توجيهك لتسجيل الدخول...', 'info');
    window.location.href = 'https://chatzeus-production.up.railway.app/auth/google'; // <--- هذا هو السطر الصحيح
}

/**
 * تبدأ عملية تسجيل الخروج.
 */
function logout() {
    // حذف التوكن من التخزين المحلي
    localStorage.removeItem('authToken');

    // إعادة تعيين حالة المستخدم في الواجهة
    currentUser = null;
    
    // ✨ إعادة تعيين البيانات المحلية بالكامل
    chats = {};
    currentChatId = null;
    // يمكنك إعادة تعيين الإعدادات إلى الافتراضية هنا إذا أردت
    
    // تحديث الواجهة لعرض زر تسجيل الدخول
    updateUserDisplay();
    
    // عرض شاشة الترحيب وإخفاء المحادثات
    document.getElementById('welcomeScreen').classList.remove('hidden');
    document.getElementById('messagesContainer').classList.add('hidden');
    
    // تحديث قائمة المحادثات (ستكون فارغة)
    displayChatHistory();

    showNotification('تم تسجيل الخروج بنجاح', 'success');
}

function renderAccountInfo() {
  const n = document.getElementById('accName');
  const e = document.getElementById('accEmail');
  const c = document.getElementById('accCreatedAt');

  if (!n || !e || !c) return;

  if (!currentUser) {
    n.textContent = 'غير مسجّل';
    e.textContent = '—';
    c.textContent = '—';
    return;
  }
  n.textContent = currentUser.name || '—';
  e.textContent = currentUser.email || '—';
  const d = currentUser.createdAt ? new Date(currentUser.createdAt) : null;
  c.textContent = d ? d.toLocaleString() : '—';
}

// ====================== واجهة حساب المستخدم (مثل GPT) ======================
function renderUserMenu(user) {
  const root = document.getElementById('user-info-container');
  if (!root) return;

  // إن لم تكن مسجلاً: زر تسجيل الدخول (نفس سلوكك الحالي)
  if (!user) {
    root.innerHTML = `
      <button onclick="loginWithGoogle()"
              class="flex items-center space-x-2 space-x-reverse bg-white hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition-colors duration-200 transform hover:scale-105 text-sm font-semibold shadow-md">
        <svg class="w-5 h-5" viewBox="0 0 18 18">
          <g fill-rule="evenodd">
            <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9.1818v3.4818h4.7909c-.2045 1.125-.8227 2.0782-1.7773 2.7218v2.2591h2.9091c1.7045-1.5682 2.6864-3.8727 2.6864-6.6218z" fill="#4285F4"></path>
            <path d="M9.1818 18c2.4455 0 4.4955-.8127 5.9955-2.1818l-2.9091-2.2591c-.8127.5455-1.8545.8727-3.0864.8727-2.3364 0-4.3182-1.5682-5.0364-3.6545H1.2727v2.3364C2.9636 16.2 5.7818 18 9.1818 18z" fill="#34A853"></path>
            <path d="M4.1455 10.8818c-.1136-.3273-.1818-.6818-.1818-1.0455s.0682-.7182.1818-1.0455V6.4545H1.2727C.9455 7.1455.7273 7.9091.7273 8.7273c0 .8182.2182 1.5818.5455 2.2727l2.8727-2.1182z" fill="#FBBC05"></path>
            <path d="M9.1818 3.6545c1.3273 0 2.5182.4545 3.4545 1.3636l2.5818-2.5818C13.6773.9818 11.6273 0 9.1818 0 5.7818 0 2.9636 1.8 1.2727 4.1182l2.8727 2.3364c.7182-2.0864 2.7-3.6545 5.0364-3.6545z" fill="#EA4335"></path>
          </g>
        </svg>
        <span>تسجيل الدخول بـ Google</span>
      </button>
    `;
    return;
  }

  // عند تسجيل الدخول: زر أفاتار + قائمة مثل GPT
  const name = user.name || 'حسابي';
  const email = user.email || '';
  const picture = user.picture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name);

  root.innerHTML = `
    <div class="relative" id="userMenu">
      <button id="userMenuBtn"
              class="user-menu-trigger flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-800/60 transition-colors">
        <img src="${picture}" alt="avatar" class="w-8 h-8 rounded-full object-cover" />
        <div class="hidden md:flex flex-col items-start leading-tight text-left">
          <span class="text-sm text-white font-semibold truncate max-w-[160px]">${name}</span>
          <span class="text-xs text-gray-400 truncate max-w-[160px]">${email}</span>
        </div>
        <i class="fas fa-chevron-down text-gray-400 text-sm md:ml-1"></i>
      </button>

      <div id="userMenuPanel"
           class="user-menu-panel absolute right-0 mt-2 w-64 rounded-xl overflow-hidden shadow-xl hidden">
        <div class="px-4 py-3 bg-gray-900/90 backdrop-blur">
          <div class="flex items-center gap-3">
            <img src="${picture}" alt="avatar" class="w-10 h-10 rounded-full object-cover" />
            <div class="min-w-0">
              <div class="text-white font-semibold truncate">${name}</div>
              <div class="text-gray-400 text-xs truncate">${email}</div>
            </div>
          </div>
        </div>

        <div class="bg-gray-950/90 backdrop-blur divide-y divide-white/5">
          <button class="menu-item w-full text-left px-4 py-3 hover:bg-white/5" onclick="openSettings()">
            <i class="fas fa-cog mr-2"></i> الإعدادات
          </button>
          <button class="menu-item w-full text-left px-4 py-3 hover:bg-white/5" onclick="toggleDarkMode()">
            <i class="fas fa-moon mr-2"></i> تبديل المظهر
          </button>
          <button class="menu-item w-full text-left px-4 py-3 hover:bg-white/5 text-red-400" onclick="logout()">
            <i class="fas fa-sign-out-alt mr-2"></i> تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  `;

  // تفعيل/إغلاق القائمة
  const btn = document.getElementById('userMenuBtn');
  const panel = document.getElementById('userMenuPanel');

  function closePanel(e) {
    if (!panel || !btn) return;
    if (e && (btn.contains(e.target) || panel.contains(e.target))) return;
    panel.classList.add('hidden');
    document.removeEventListener('click', closePanel);
  }

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    panel?.classList.toggle('hidden');
    if (!panel?.classList.contains('hidden')) {
      setTimeout(() => document.addEventListener('click', closePanel), 0);
    } else {
      document.removeEventListener('click', closePanel);
    }
  });
}

// ===== تبويبات نافذة الإعدادات =====
function activateSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('#settingsPanels .settings-panel').forEach(p => {
    p.classList.toggle('hidden', p.dataset.tab !== tab);
  });
}

// مستمع عام للنقر على تبويبات الإعدادات
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.settings-tab');
  if (!btn) return;
  activateSettingsTab(btn.dataset.tab);
});

// (اختياري) استدعاء عند فتح النافذة لأول مرة
function onOpenSettingsModal() {
  // اجعل تبويب "الحساب" هو الافتراضي
  activateSettingsTab('account');
}
// --- Marked.js configuration ---
// Ensure marked.js is loaded before this script if you use it for Markdown parsing.
// You might need to include it in your index.html:
// <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
// Or handle its loading dynamically.

// --- Highlight.js configuration ---
// Ensure highlight.js is loaded and CSS is included for code highlighting.
// You might need to include it in your index.html:
// <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css">
// <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/go.min.js"></script> <!-- Example language -->
// document.addEventListener('DOMContentLoaded', (event) => {
//   hljs.highlightAll();
// });
