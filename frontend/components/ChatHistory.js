/* eslint-disable no-unused-vars */
const ChatHistory = {
  props: {
    chats: {
      type: Object,
      required: true,
    },
    currentChatId: {
      type: String,
      default: null,
    },
    isSidebarOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['select-chat', 'new-chat', 'delete-chat', 'update-chat-title', 'close-sidebar', 'reorder-chats'],
  data() {
    return {
      editingChatId: null,
      editingTitle: '',
      draggedChatId: null,
    };
  },
  computed: {
    sortedChats() {
      if (!this.chats) return [];
      return Object.values(this.chats).sort((a, b) => (b.order || 0) - (a.order || 0));
    },
  },
  methods: {
    closeSidebar() {
      this.$emit('close-sidebar');
    },
    startNewChat() {
      this.$emit('new-chat');
    },
    selectChat(chatId) {
      if (this.editingChatId !== chatId) {
        this.$emit('select-chat', chatId);
      }
    },
    deleteChat(chatId, event) {
        event.stopPropagation();
        if (confirm('هل أنت متأكد من حذف هذه المحادثة؟')) {
            this.$emit('delete-chat', chatId);
        }
    },
    toggleEditChatTitle(chat, event) {
        event.stopPropagation();
        this.editingChatId = chat._id;
        this.editingTitle = chat.title;
        // Focus the input element after the DOM updates
        this.$nextTick(() => {
            const input = this.$refs[`titleInput-${chat._id}`];
            if (input && input[0]) {
                input[0].focus();
                input[0].select();
            }
        });
    },
    saveChatTitle(chatId) {
        if (this.editingTitle.trim() && this.editingChatId) {
            this.$emit('update-chat-title', { id: chatId, title: this.editingTitle.trim() });
        }
        this.editingChatId = null;
        this.editingTitle = '';
    },
    cancelEdit() {
        this.editingChatId = null;
        this.editingTitle = '';
    },
    handleDragStart(e, chat) {
        this.draggedChatId = chat._id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', chat._id);
        setTimeout(() => {
            e.target.classList.add('dragging');
        }, 0);
    },
    handleDragEnter(e) {
        e.preventDefault();
        const dropTarget = e.target.closest('[data-chat-id]');
        if (dropTarget && dropTarget.dataset.chatId !== this.draggedChatId) {
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
    },
    handleDragOver(e) {
        e.preventDefault();
    },
    handleDragLeave(e) {
        const chatHistoryEl = this.$refs.chatHistory;
        if (chatHistoryEl && !chatHistoryEl.contains(e.relatedTarget)) {
            document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
        }
    },
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const sourceChatId = e.dataTransfer.getData('text/plain');
        const dropIndicator = document.querySelector('.drop-indicator');

        if (!dropIndicator || !this.chats[sourceChatId]) {
            if (dropIndicator) dropIndicator.remove();
            return;
        }

        const nextSibling = dropIndicator.nextElementSibling;
        const prevSibling = dropIndicator.previousElementSibling;

        const orderBefore = nextSibling && nextSibling.hasAttribute('data-chat-id') ? this.chats[nextSibling.getAttribute('data-chat-id')].order : null;
        const orderAfter = prevSibling && prevSibling.hasAttribute('data-chat-id') ? this.chats[prevSibling.getAttribute('data-chat-id')].order : null;

        let newOrder;
        if (orderBefore === null && orderAfter !== null) {
            newOrder = orderAfter - 1000;
        } else if (orderBefore !== null && orderAfter === null) {
            newOrder = orderBefore + 1000;
        } else if (orderBefore !== null && orderAfter !== null) {
            newOrder = (orderBefore + orderAfter) / 2;
        } else {
            dropIndicator.remove();
            return;
        }

        this.$emit('reorder-chats', { chatId: sourceChatId, newOrder });
        dropIndicator.remove();
    },
    handleDragEnd() {
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
    },
    getPreview(chat) {
        const lastMessage = chat.messages[chat.messages.length - 1];
        const preview = lastMessage ? (lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')) : 'محادثة فارغة';
        return preview;
    }
  },
  template: `
    <div
        id="sidebar"
        class="fixed inset-y-0 right-0 sidebar-width w-80 glass-effect shadow-2xl z-40 sidebar-transition flex flex-col"
        :class="isSidebarOpen ? 'translate-x-0' : 'translate-x-full'"
    >
        <div class="p-6 border-b border-white/20">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-bold text-gray-800 dark:text-white">المحادثات</h2>
                <button @click="closeSidebar" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="إغلاق الشريط الجانبي" aria-controls="sidebar">
                    <i class="fas fa-times text-xl" aria-hidden="true"></i>
                </button>
            </div>
            <button @click="startNewChat" class="w-full mt-4 bg-zeus-accent hover:bg-zeus-accent-hover text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                aria-label="إنشاء محادثة جديدة" title="إنشاء محادثة جديدة">
                <i class="fas fa-plus ml-2" aria-hidden="true"></i>محادثة جديدة
            </button>
        </div>
        <div ref="chatHistory" class="flex-1 overflow-y-auto p-4 space-y-2" @dragleave="handleDragLeave">
            <div v-if="!sortedChats.length" class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-comments text-2xl mb-2"></i>
                <p>لا توجد محادثات بعد</p>
                <p class="text-xs">ابدأ محادثة جديدة لرؤيتها هنا</p>
            </div>
            <div
                v-for="chat in sortedChats"
                :key="chat._id"
                :data-chat-id="chat._id"
                @click="selectChat(chat._id)"
                :class="['p-3', 'rounded-lg', 'cursor-pointer', 'transition-colors', { 'bg-zeus-accent text-white': chat._id === currentChatId, 'hover:bg-white/10 text-gray-300': chat._id !== currentChatId }]"
                draggable="true"
                @dragstart="handleDragStart($event, chat)"
                @dragenter="handleDragEnter"
                @dragover="handleDragOver"
                @drop="handleDrop"
                @dragend="handleDragEnd"
            >
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <template v-if="editingChatId === chat._id">
                            <input
                                type="text"
                                v-model="editingTitle"
                                :ref="'titleInput-' + chat._id"
                                class="w-full bg-transparent text-white border-b border-white/50 focus:outline-none text-base font-medium"
                                style="direction: rtl;"
                                @click.stop
                                @blur="saveChatTitle(chat._id)"
                                @keydown.enter.prevent="saveChatTitle(chat._id)"
                                @keydown.escape="cancelEdit"
                            />
                        </template>
                        <template v-else>
                            <h4 class="font-medium truncate">{{ chat.title }}</h4>
                        </template>
                        <p class="text-sm opacity-70 truncate">{{ getPreview(chat) }}</p>
                    </div>
                    <div class="flex items-center ml-2 space-x-1 space-x-reverse">
                        <button @click.stop="toggleEditChatTitle(chat, $event)" class="p-1 rounded hover:bg-white/20 text-gray-300 hover:text-white transition-colors" title="تعديل الاسم">
                            <i class="fas fa-pen text-xs"></i>
                        </button>
                        <button @click.stop="deleteChat(chat._id, $event)" class="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors" title="حذف المحادثة">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  `
};

export default ChatHistory;
