/* eslint-disable no-unused-vars */
import ChatHistory from './components/ChatHistory.js';

const { createApp } = Vue;

const app = createApp({
  components: {
    'chat-history': ChatHistory,
  },
  data() {
    return {
      // App state
      currentUser: null,
      currentChatId: null,
      chats: {},
      settings: {},
      isSidebarOpen: false,

      // UI State
      streamingState: {
        isStreaming: false,
        currentMessageId: null,
        streamController: null,
        currentText: '',
        streamingElement: null,
        chatId: null,
      },

      // Static configurations
      API_BASE_URL: 'https://chatzeus-production.up.railway.app',
      defaultSettings: {
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
        theme: 'blue'
      },
      providers: {
        gemini: {
          name: 'Google Gemini',
          models: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-pro', name: 'Gemini Pro' },
          ]
        },
        openrouter: {
          name: 'OpenRouter',
          models: [
            { id: 'google/gemma-2-9b-it:free', name: 'Google: Gemma 2 9B (Free)' },
            { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Meta: Llama 3.1 8B (Free)' },
            { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Microsoft: Phi-3 Mini (Free)' },
          ]
        }
      },
    };
  },
  mounted() {
    // Initialize app after mounting
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        console.log("Token found in URL, saving to localStorage.");
        localStorage.setItem('authToken', token);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // this.initializeTheme(); // Will be handled by settings
    this.updateCustomProviders();
    // this.updateSendButton(); // Will be computed property
    this.initializeEventListeners();

    this.checkUserStatus();

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.streamingState.isStreaming) {
            this.cancelStreaming('escape');
        }
    });

    window.addEventListener('beforeunload', () => {
        if (this.streamingState.isStreaming && this.streamingState.streamController) {
            this.streamingState.streamController.abort();
        }
    });
  },
  methods: {
    // ===============================================
    // Component Event Handlers
    // ===============================================
    handleSelectChat(chatId) {
        this.switchToChat(chatId);
    },
    async handleNewChat() {
        await this.startNewChat();
    },
    async handleDeleteChat(chatId) {
        await this.deleteChat(chatId);
    },
    async handleUpdateChatTitle({ id, title }) {
        await this.updateChatTitle(id, title);
    },
    handleCloseSidebar() {
        this.isSidebarOpen = false;
    },
    handleReorderChats({ chatId, newOrder }) {
        this.chats[chatId].order = newOrder;
        // The component will re-render automatically, just need to save
        this.saveCurrentChat(chatId);
    },

    // ===============================================
    // Chat Management
    // ===============================================
    async startNewChat() {
        const chatId = Date.now().toString();
        this.currentChatId = chatId;
        const now = Date.now();
        this.chats[chatId] = {
            _id: chatId,
            title: 'محادثة جديدة',
            messages: [],
            createdAt: now,
            updatedAt: now,
            order: now,
            isTemporary: true
        };
        document.getElementById('welcomeScreen').classList.remove('hidden');
        document.getElementById('messagesContainer').classList.add('hidden');
        document.getElementById('messagesArea').innerHTML = '';
    },
    switchToChat(chatId) {
        if (!this.chats[chatId]) return;

        this.currentChatId = chatId;
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('messagesContainer').classList.remove('hidden');

        this.displayMessages();
        this.isSidebarOpen = false;
    },
    async deleteChat(chatId) {
        if (!this.chats[chatId]) return;

        const token = localStorage.getItem('authToken');
        const temp = this.chats[chatId].isTemporary === true || !this.isValidObjectId(chatId);

        if (temp || !token) {
            delete this.chats[chatId];
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
                document.getElementById('welcomeScreen').classList.remove('hidden');
                document.getElementById('messagesContainer').classList.add('hidden');
            }
            this.showNotification('تم حذف المحادثة محليًا.', 'success');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/api/chats/${chatId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('فشل حذف المحادثة من الخادم.');

            delete this.chats[chatId];
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
                document.getElementById('welcomeScreen').classList.remove('hidden');
                document.getElementById('messagesContainer').classList.add('hidden');
            }
            this.showNotification('تم حذف المحادثة بنجاح.', 'success');
        } catch (error) {
            console.error('Error deleting chat:', error);
            this.showNotification(error.message, 'error');
        }
    },
    updateChatTitle(chatId, newTitle) {
        if (newTitle && newTitle.trim() !== '') {
            const now = Date.now();
            this.chats[chatId].title = newTitle.trim();
            this.chats[chatId].updatedAt = now;
            this.chats[chatId].order = now;
            this.saveCurrentChat(chatId);
        }
    },
    async saveCurrentChat(chatIdParam = this.currentChatId) {
        if (!chatIdParam || !this.chats[chatIdParam]) return;
        const token = localStorage.getItem('authToken');
        if (!token) return;

        try {
            const payload = this.sanitizeChatForSave(this.chats[chatIdParam]);
            const response = await fetch(`${this.API_BASE_URL}/api/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(txt || 'Failed to save chat to the database.');
            }

            const savedChat = await response.json();
            this.chats[savedChat._id] = { ...savedChat, isTemporary: false };

            const wasTemp = !this.isValidObjectId(chatIdParam);
            if (wasTemp && chatIdParam !== savedChat._id) {
                delete this.chats[chatIdParam];
            }

            if (this.currentChatId === chatIdParam) this.currentChatId = savedChat._id;
            if (this.streamingState.chatId === chatIdParam) this.streamingState.chatId = savedChat._id;

            console.log('Chat saved successfully to DB:', savedChat._id);
        } catch (error) {
            console.error('Error saving chat:', error);
            this.showNotification(`حدث خطأ أثناء حفظ المحادثة: ${error.message}`, 'error');
        }
    },

    // ===============================================
    // UI and Display
    // ===============================================
    displayMessages() {
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.innerHTML = '';
        if (!this.currentChatId || !this.chats[this.currentChatId]) return;
        this.chats[this.currentChatId].messages.forEach(message => {
            this.displayMessage(message);
        });
        this.scrollToBottom();
    },
    displayMessage(message) {
        // This function will remain largely the same, but it's a method now.
        // It will still perform DOM manipulation on the messagesArea.
        // This part can be refactored into a Message component later.
        const messagesArea = document.getElementById('messagesArea');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-bubble message-${message.role}`;

        if (message.role === 'user') {
            messageDiv.innerHTML = `<div class="message-content">${this.escapeHtml(message.content)}</div>`;
        } else {
            const renderedContent = marked.parse(message.content);
            messageDiv.innerHTML = `<div class="message-content">${renderedContent}</div>`;
            messageDiv.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
                this.addCodeHeader(block.parentElement);
            });
            this.addMessageActions(messageDiv, message.content);
        }
        messagesArea.appendChild(messageDiv);
    },
    scrollToBottom() {
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.scrollTop = messagesArea.scrollHeight;
        setTimeout(() => {
            messagesArea.scrollTo({
                top: messagesArea.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
    },
    openSidebar() {
        this.isSidebarOpen = true;
    },

    // ===============================================
    // Auth
    // ===============================================
    async checkUserStatus() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            this.currentUser = null;
            this.settings = { ...this.defaultSettings };
            return;
        }
        try {
            const userResponse = await fetch(`${this.API_BASE_URL}/api/user`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!userResponse.ok) throw new Error('Invalid token');
            const userData = await userResponse.json();
            this.currentUser = userData.user;

            const dataResponse = await fetch(`${this.API_BASE_URL}/api/data`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!dataResponse.ok) throw new Error('Failed to fetch user data');
            const data = await dataResponse.json();

            this.chats = data.chats.reduce((acc, chat) => { acc[chat._id] = chat; return acc; }, {});
            this.settings = { ...this.defaultSettings, ...data.settings };

            if (Object.keys(this.chats).length > 0) {
                const latestChatId = Object.values(this.chats).sort((a, b) => (b.order || 0) - (a.order || 0))[0]._id;
                this.switchToChat(latestChatId);
            }
        } catch (error) {
            console.error("Check user status failed:", error.message);
            localStorage.removeItem('authToken');
            this.currentUser = null;
            this.chats = {};
            this.settings = { ...this.defaultSettings };
        }
    },

    // ===============================================
    // Helpers (no change)
    // ===============================================
    isValidObjectId(id) {
        return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
    },
    sanitizeChatForSave(chat) {
      const safeMessages = (chat.messages || []).map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: m.timestamp || Date.now(),
        attachments: (m.attachments || []).map(a => ({
          name: a.name, type: a.type, size: a.size, fileId: a.fileId || null, fileUrl: a.fileUrl || null
        }))
      }));
      return {
        _id: chat._id, title: chat.title || 'محادثة', messages: safeMessages,
        createdAt: chat.createdAt || Date.now(), updatedAt: Date.now(), order: chat.order || Date.now()
      };
    },
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type} animate-fade-in pointer-events-auto`;
        notification.innerHTML = `<div class="flex items-center"><i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} ml-2"></i><span>${message}</span></div>`;
        container.appendChild(notification);
        setTimeout(() => { notification.remove(); }, 5000);
    },
    addCodeHeader(preElement) {
        // ... (implementation remains the same, but as a method)
    },
    addMessageActions(messageElement, content) {
        // ... (implementation remains the same, but as a method)
    },
    initializeEventListeners() {
        // This can be simplified or removed as Vue handles it.
        // For now, we'll leave the non-component parts.
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // this.sendMessage(); // This will be handled by a @keydown binding in the template later
                }
            });
        }
    },
    updateCustomProviders() {
        // ...
    }
    // ... other methods like sendMessage, streaming logic, etc. will go here
  },
});

app.mount('#app');
