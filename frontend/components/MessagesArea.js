export default {
  props: {
    currentChat: { type: Object, default: null },
    streamingState: { type: Object, required: true },
  },
  watch: {
    'currentChat.messages': {
        handler() {
            this.$nextTick(() => {
                this.scrollToBottom();
                this.highlightCode();
            });
        },
        deep: true,
    },
    'streamingState.currentText': {
        handler() {
            this.$nextTick(() => {
                this.scrollToBottom(true); // Force scroll during streaming
                this.highlightCode();
            });
        }
    }
  },
  methods: {
    scrollToBottom(smooth = false) {
      const messagesArea = this.$refs.messagesArea;
      if (messagesArea) {
        messagesArea.scrollTo({
            top: messagesArea.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
      }
    },
    renderMarkdown(content) {
      return marked.parse(content || '');
    },
    highlightCode() {
        this.$el.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
            // We can add the copy button logic here if needed
        });
    },
    copyMessage(content) {
        navigator.clipboard.writeText(content).then(() => {
            // Maybe emit an event to show notification
        }).catch(err => console.error('Failed to copy message:', err));
    }
  },
  template: `
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- Welcome Screen -->
      <div v-if="!currentChat" id="welcomeScreen" class="flex-1 flex items-center justify-center p-8">
        <div class="text-center max-w-2xl">
            <div class="zeus-logo w-20 h-20 mx-auto mb-6 rounded-full"></div>
            <h2 class="text-3xl font-bold text-white mb-4">مرحباً بك في شات زيوس</h2>
            <p class="text-gray-400 text-lg mb-8">إله الرعد والحكمة في خدمتك. ابدأ محادثة جديدة واكتشف قوة الذكاء الاصطناعي.</p>
            <div class="welcome-grid grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div class="glass-effect p-6 rounded-xl"><i class="fas fa-lightbulb text-zeus-accent text-2xl mb-4"></i><h3 class="text-white font-semibold mb-2">أسئلة ذكية</h3><p class="text-gray-400 text-sm">احصل على إجابات دقيقة ومفيدة لجميع استفساراتك</p></div>
                <div class="glass-effect p-6 rounded-xl"><i class="fas fa-code text-zeus-accent text-2xl mb-4"></i><h3 class="text-white font-semibold mb-2">مساعدة برمجية</h3><p class="text-gray-400 text-sm">حلول برمجية متقدمة وشرح للأكواد المعقدة</p></div>
                <div class="glass-effect p-6 rounded-xl"><i class="fas fa-language text-zeus-accent text-2xl mb-4"></i><h3 class="text-white font-semibold mb-2">دعم متعدد اللغات</h3><p class="text-gray-400 text-sm">تفاعل بالعربية والإنجليزية بسهولة تامة</p></div>
                <div class="glass-effect p-6 rounded-xl"><i class="fas fa-bolt text-zeus-accent text-2xl mb-4"></i><h3 class="text-white font-semibold mb-2">استجابات سريعة</h3><p class="text-gray-400 text-sm">ردود فورية وذكية تلبي احتياجاتك</p></div>
            </div>
        </div>
      </div>

      <!-- Messages Container -->
      <div v-else id="messagesContainer" class="flex-1 flex flex-col overflow-hidden">
        <div ref="messagesArea" class="flex-1 overflow-y-auto p-6 space-y-4" aria-live="polite">
          <div v-for="message in currentChat.messages" :key="message.timestamp" :class="['chat-bubble', 'message-' + message.role]">
            <div class="message-content" v-html="renderMarkdown(message.content)"></div>
            <div v-if="message.role === 'assistant'" class="message-actions">
                <button @click="copyMessage(message.content)" class="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-white/10" title="نسخ">
                    <i class="fas fa-copy text-xs"></i>
                </button>
            </div>
          </div>

          <!-- Streaming Message -->
          <div v-if="streamingState.isStreaming" :class="['chat-bubble', 'message-assistant', 'streaming-message']">
            <div class="message-content" v-html="renderMarkdown(streamingState.currentText)"></div>
            <div class="streaming-indicator">
                <i class="fas fa-robot text-xs"></i>
                <span>يكتب زيوس</span>
                <div class="streaming-dots"><div class="streaming-dot"></div><div class="streaming-dot"></div><div class="streaming-dot"></div></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  `
};
