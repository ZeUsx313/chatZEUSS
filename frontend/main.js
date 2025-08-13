/* eslint-disable no-unused-vars */
import ChatHistory from './components/ChatHistory.js';
import SettingsModal from './components/SettingsModal.js';
import MessagesArea from './components/MessagesArea.js';
import MessageInput from './components/MessageInput.js';
import UserMenu from './components/UserMenu.js';

const { createApp } = Vue;

const app = createApp({
  components: {
    'chat-history': ChatHistory,
    'settings-modal': SettingsModal,
    'messages-area': MessagesArea,
    'message-input': MessageInput,
    'user-menu': UserMenu,
  },
  data() {
    return {
      currentUser: null,
      currentChatId: null,
      chats: {},
      settings: {},
      isSidebarOpen: false,
      isSettingsVisible: false,
      streamingState: { isStreaming: false, currentText: '' },
      API_BASE_URL: 'https://chatzeus-production.up.railway.app',
      // ... other data properties
    };
  },
  computed: {
    currentChat() {
        return this.currentChatId ? this.chats[this.currentChatId] : null;
    }
  },
  mounted() {
    this.checkUserStatus();
    // ...
  },
  methods: {
    // Component Event Handlers
    handleSelectChat(chatId) { this.switchToChat(chatId); },
    handleNewChat() { this.startNewChat(); },
    handleDeleteChat(chatId) { this.deleteChat(chatId); },
    handleUpdateChatTitle({ id, title }) { this.updateChatTitle(id, title); },
    handleCloseSidebar() { this.isSidebarOpen = false; },
    handleReorderChats({ chatId, newOrder }) { /* ... */ },
    openSettingsModal() { this.isSettingsVisible = true; },
    closeSettingsModal() { this.isSettingsVisible = false; },
    async handleSaveSettings(newSettings) { /* ... */ },
    handleStopStreaming() { this.cancelStreaming(); },
    async handleSendMessage({ text, files }) { /* ... */ },

    handleLogin() {
        window.location.href = `${this.API_BASE_URL}/auth/google`;
    },
    handleLogout() {
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.chats = {};
        this.currentChatId = null;
        this.settings = {}; // Reset settings
        this.showNotification('تم تسجيل الخروج بنجاح', 'success');
    },
    handleOpenSettings() {
        this.openSettingsModal();
    },

    // Core App Logic
    openSidebar() { this.isSidebarOpen = true; },
    async checkUserStatus() { /* ... */ },
    // ... other methods
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (container) {
            const notification = document.createElement('div');
            notification.className = `notification ${type} animate-fade-in pointer-events-auto`;
            notification.innerHTML = `<div class="flex items-center"><i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'} ml-2"></i><span>${message}</span></div>`;
            container.appendChild(notification);
            setTimeout(() => { notification.remove(); }, 5000);
        }
    }
  },
});

app.mount('#app');
