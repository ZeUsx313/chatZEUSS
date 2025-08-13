export default {
  props: {
    isSettingsVisible: { type: Boolean, default: false },
    initialSettings: { type: Object, required: true },
    currentUser: { type: Object, default: null },
    providers: { type: Object, required: true },
  },
  emits: ['close', 'save-settings'],
  data() {
    return {
      activeTab: 'account',
      localSettings: JSON.parse(JSON.stringify(this.initialSettings)),
      isCustomModelsVisible: false,
      isCustomProvidersVisible: false,
    };
  },
  watch: {
    initialSettings: {
      handler(newVal) {
        this.localSettings = JSON.parse(JSON.stringify(newVal));
      },
      deep: true,
    },
  },
  computed: {
    accountCreationDate() {
      if (!this.currentUser || !this.currentUser.createdAt) return '—';
      return new Date(this.currentUser.createdAt).toLocaleString();
    },
    currentProviderModels() {
        const providerKey = this.localSettings.provider;
        if (this.providers[providerKey] && this.providers[providerKey].models) {
            return this.providers[providerKey].models;
        }
        return [];
    }
  },
  methods: {
    closeAllModals() { this.$emit('close'); },
    saveAndClose() { this.$emit('save-settings', this.localSettings); },
    activateTab(tab) { this.activeTab = tab; },

    // API Key Management
    addApiKey(provider) { this.localSettings[`${provider}ApiKeys`].push({ key: '', status: 'active' }); },
    removeApiKey(provider, index) { this.localSettings[`${provider}ApiKeys`].splice(index, 1); },
    toggleApiKeyVisibility(event) {
        const input = event.target.closest('.relative').querySelector('input');
        const icon = event.target.closest('button').querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    },

    // Custom Providers
    openCustomProvidersManager() { this.isCustomProvidersVisible = true; },
    closeCustomProvidersManager() { this.isCustomProvidersVisible = false; },
    addCustomProvider() {
        const newId = `custom_${Date.now()}`;
        this.localSettings.customProviders.push({ id: newId, name: 'مزود جديد', baseUrl: '', models: [], apiKeys: [] });
    },
    removeCustomProvider(index) { this.localSettings.customProviders.splice(index, 1); },

    // Custom Models
    openCustomModelsManager() { this.isCustomModelsVisible = true; },
    closeCustomModelsManager() { this.isCustomModelsVisible = false; },
    addCustomModel() {
        this.localSettings.customModels.push({ id: '', name: 'نموذج جديد', provider: 'gemini', defaultTemperature: 0.7, description: '' });
    },
    removeCustomModel(index) { this.localSettings.customModels.splice(index, 1); }
  },
  template: `
    <div v-if="isSettingsVisible" @keydown.esc="closeAllModals" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true">

      <!-- Main Settings Modal -->
      <div class="settings-modal glass-effect rounded-xl shadow-2xl w-full max-w-5xl mx-4 animate-fade-in overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 class="text-xl font-bold text-gray-800 dark:text-white">الإعدادات</h3>
          <button @click="closeAllModals" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-white/10" aria-label="إغلاق الإعدادات">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <div class="flex h-[70vh]">
          <aside class="w-64 p-4 border-l border-white/10 overflow-y-auto">
            <button class="settings-tab" :class="{ 'active': activeTab === 'account' }" @click="activateTab('account')"><i class="fas fa-user ml-2"></i>الحساب</button>
            <button class="settings-tab" :class="{ 'active': activeTab === 'models' }" @click="activateTab('models')"><i class="fas fa-robot ml-2"></i>النماذج والمزوّد</button>
            <button class="settings-tab" :class="{ 'active': activeTab === 'appearance' }" @click="activateTab('appearance')"><i class="fas fa-palette ml-2"></i>المظهر</button>
          </aside>
          <section class="flex-1 overflow-y-auto p-6 space-y-6">

            <!-- Account Panel -->
            <div v-if="activeTab === 'account'" class="settings-panel">
              <div class="settings-section">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div class="text-sm text-gray-400">الاسم</div>
                    <div class="text-base font-medium text-white">{{ currentUser ? currentUser.name : '—' }}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-400">البريد</div>
                    <div class="text-base font-medium text-white">{{ currentUser ? currentUser.email : '—' }}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-400">تاريخ التسجيل</div>
                    <div class="text-base font-medium text-white">{{ accountCreationDate }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Models Panel -->
            <div v-if="activeTab === 'models'" class="settings-panel">
                <div class="settings-section">
                    <label class="block text-sm font-medium text-gray-300 mb-2">مزود الذكاء الاصطناعي</label>
                    <select v-model="localSettings.provider" class="w-full form-input">
                        <option v-for="(provider, key) in providers" :key="key" :value="key">{{ provider.name }}</option>
                    </select>
                </div>

                <div class="settings-section">
                    <label class="block text-sm font-medium text-gray-300 mb-2">نموذج الذكاء الاصطناعي</label>
                    <select v-model="localSettings.model" class="w-full form-input">
                        <option v-for="model in currentProviderModels" :key="model.id" :value="model.id">{{ model.name }}</option>
                    </select>
                </div>

                <div class="settings-section">
                    <label class="block text-sm font-medium text-gray-300 mb-2">درجة الحرارة: {{ localSettings.temperature }}</label>
                    <input type="range" v-model.number="localSettings.temperature" min="0" max="1" step="0.1" class="w-full accent-zeus-accent">
                </div>
            </div>

            <!-- Appearance Panel -->
            <div v-if="activeTab === 'appearance'" class="settings-panel">
                <div class="settings-section">
                    <label class="block text-sm font-medium text-gray-300 mb-2">حجم خط الرسائل: {{ localSettings.fontSize }}px</label>
                    <input type="range" v-model.number="localSettings.fontSize" min="14" max="24" step="1" class="w-full accent-zeus-accent">
                </div>
                <div class="settings-section">
                    <label class="block text-sm font-medium text-gray-300 mb-2">ثيم الواجهة</label>
                    <select v-model="localSettings.theme" class="w-full form-input">
                        <option value="blue">أزرق داكن</option>
                        <option value="black">أسود كامل</option>
                        <option value="light">نهاري أبيض</option>
                    </select>
                </div>
            </div>

          </section>
        </div>
        <div class="flex justify-end px-6 py-4 border-t border-white/10">
          <button @click="closeAllModals" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500">إلغاء</button>
          <button @click="saveAndClose" class="px-4 py-2 bg-zeus-accent text-white rounded-lg ml-2">حفظ</button>
        </div>
      </div>
    </div>
  `
};
