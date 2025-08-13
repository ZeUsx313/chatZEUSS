export default {
  props: {
    currentUser: { type: Object, default: null },
  },
  emits: ['login', 'logout', 'open-settings'],
  data() {
    return {
      isMenuOpen: false,
    };
  },
  computed: {
    userName() {
      return this.currentUser ? this.currentUser.name : 'حسابي';
    },
    userEmail() {
      return this.currentUser ? this.currentUser.email : '';
    },
    userPicture() {
      if (this.currentUser && this.currentUser.picture) {
        return this.currentUser.picture;
      }
      return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.userName);
    }
  },
  methods: {
    toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
      if (this.isMenuOpen) {
        // Add a click-outside listener
        document.addEventListener('click', this.closeMenuOnClickOutside);
      } else {
        document.removeEventListener('click', this.closeMenuOnClickOutside);
      }
    },
    closeMenuOnClickOutside(event) {
      if (this.$el && !this.$el.contains(event.target)) {
        this.isMenuOpen = false;
        document.removeEventListener('click', this.closeMenuOnClickOutside);
      }
    },
    handleLogin() { this.$emit('login'); },
    handleLogout() { this.$emit('logout'); this.isMenuOpen = false; },
    handleOpenSettings() { this.$emit('open-settings'); this.isMenuOpen = false; }
  },
  beforeUnmount() {
    // Cleanup listener
    document.removeEventListener('click', this.closeMenuOnClickOutside);
  },
  template: `
    <div class="relative">
      <!-- Logged Out State -->
      <div v-if="!currentUser">
        <button @click="handleLogin" class="flex items-center space-x-2 space-x-reverse bg-white hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition-colors duration-200 transform hover:scale-105 text-sm font-semibold shadow-md">
            <svg class="w-5 h-5" viewBox="0 0 18 18"><g fill-rule="evenodd"><path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9.1818v3.4818h4.7909c-.2045 1.125-.8227 2.0782-1.7773 2.7218v2.2591h2.9091c1.7045-1.5682 2.6864-3.8727 2.6864-6.6218z" fill="#4285F4"></path><path d="M9.1818 18c2.4455 0 4.4955-.8127 5.9955-2.1818l-2.9091-2.2591c-.8127.5455-1.8545.8727-3.0864.8727-2.3364 0-4.3182-1.5682-5.0364-3.6545H1.2727v2.3364C2.9636 16.2 5.7818 18 9.1818 18z" fill="#34A853"></path><path d="M4.1455 10.8818c-.1136-.3273-.1818-.6818-.1818-1.0455s.0682-.7182.1818-1.0455V6.4545H1.2727C.9455 7.1455.7273 7.9091.7273 8.7273c0 .8182.2182 1.5818.5455 2.2727l2.8727-2.1182z" fill="#FBBC05"></path><path d="M9.1818 3.6545c1.3273 0 2.5182.4545 3.4545 1.3636l2.5818-2.5818C13.6773.9818 11.6273 0 9.1818 0 5.7818 0 2.9636 1.8 1.2727 4.1182l2.8727 2.3364c.7182-2.0864 2.7-3.6545 5.0364-3.6545z" fill="#EA4335"></path></g></svg>
            <span>تسجيل الدخول بـ Google</span>
        </button>
      </div>

      <!-- Logged In State -->
      <div v-if="currentUser">
        <button @click="toggleMenu" class="user-menu-trigger flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-800/60 transition-colors">
            <img :src="userPicture" alt="avatar" class="w-8 h-8 rounded-full object-cover" />
            <div class="hidden md:flex flex-col items-start leading-tight text-left">
                <span class="text-sm text-white font-semibold truncate max-w-[160px]">{{ userName }}</span>
                <span class="text-xs text-gray-400 truncate max-w-[160px]">{{ userEmail }}</span>
            </div>
            <i class="fas fa-chevron-down text-gray-400 text-sm md:ml-1"></i>
        </button>

        <div v-if="isMenuOpen" class="user-menu-panel absolute right-0 mt-2 w-64 rounded-xl overflow-hidden shadow-xl">
            <div class="px-4 py-3 bg-gray-900/90 backdrop-blur">
                <div class="flex items-center gap-3">
                    <img :src="userPicture" alt="avatar" class="w-10 h-10 rounded-full object-cover" />
                    <div class="min-w-0">
                        <div class="text-white font-semibold truncate">{{ userName }}</div>
                        <div class="text-gray-400 text-xs truncate">{{ userEmail }}</div>
                    </div>
                </div>
            </div>
            <div class="bg-gray-950/90 backdrop-blur divide-y divide-white/5">
                <button @click="handleOpenSettings" class="menu-item w-full text-left px-4 py-3 hover:bg-white/5">
                    <i class="fas fa-cog mr-2"></i> الإعدادات
                </button>
                <button @click="handleLogout" class="menu-item w-full text-left px-4 py-3 hover:bg-white/5 text-red-400">
                    <i class="fas fa-sign-out-alt mr-2"></i> تسجيل الخروج
                </button>
            </div>
        </div>
      </div>
    </div>
  `
};
