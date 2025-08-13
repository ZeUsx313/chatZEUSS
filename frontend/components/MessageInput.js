export default {
  props: {
    isStreaming: { type: Boolean, default: false },
  },
  emits: ['send-message', 'stop-streaming'],
  data() {
    return {
      messageText: '',
      attachedFiles: [],
    };
  },
  computed: {
    canSendMessage() {
      return !this.isStreaming && (this.messageText.trim().length > 0 || this.attachedFiles.length > 0);
    }
  },
  methods: {
    autoResizeTextarea(event) {
      const textarea = event.target;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
    },
    handleFileSelection(event) {
      this.attachedFiles = Array.from(event.target.files);
    },
    clearFileInput() {
      this.attachedFiles = [];
      this.$refs.fileInput.value = ''; // Reset the file input
    },
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    submitMessage() {
      if (!this.canSendMessage) return;
      this.$emit('send-message', {
        text: this.messageText,
        files: this.attachedFiles,
      });
      this.messageText = '';
      this.clearFileInput();
      this.$refs.textarea.style.height = 'auto'; // Reset height
    },
    handleSendClick() {
        if (this.isStreaming) {
            this.$emit('stop-streaming');
        } else {
            this.submitMessage();
        }
    },
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.submitMessage();
        }
    }
  },
  template: `
    <div class="flex-shrink-0 border-t border-gray-800 bg-black p-6 footer-input">
      <div class="max-w-4xl mx-auto">
        <div class="relative">
          <!-- File Preview Container -->
          <div v-if="attachedFiles.length > 0" class="mb-4">
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-300">الملفات المرفقة:</span>
                <button @click="clearFileInput" class="text-gray-400 hover:text-gray-200 text-sm">
                  <i class="fas fa-times ml-1"></i>مسح الكل
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <div v-for="(file, index) in attachedFiles" :key="index" class="inline-flex items-center bg-gray-700 rounded-lg px-3 py-2 text-sm">
                  <span class="text-gray-200 ml-2">{{ file.name }}</span>
                  <span class="text-gray-400 text-xs ml-2">({{ formatFileSize(file.size) }})</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Input Area -->
          <div class="flex items-end space-x-3 space-x-reverse">
            <label for="fileInput" class="cursor-pointer text-gray-400 hover:text-gray-200 transition-colors p-3 rounded-xl hover:bg-gray-700" title="إرفاق ملف">
              <i class="fas fa-paperclip text-2xl"></i>
              <input type="file" ref="fileInput" id="fileInput" multiple class="hidden" @change="handleFileSelection">
            </label>

            <div class="flex-1 relative">
              <textarea
                ref="textarea"
                v-model="messageText"
                @input="autoResizeTextarea"
                @keydown="handleKeyDown"
                placeholder="تكلم عن أي شيء."
                class="chat-input w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-zeus-accent focus:border-transparent resize-none"
                rows="1"
                style="max-height: 128px;"
              ></textarea>
            </div>

            <button
              @click="handleSendClick"
              :disabled="!canSendMessage && !isStreaming"
              :class="[
                'px-6 py-3 text-white rounded-xl transition-all duration-200 transform',
                isStreaming ? 'bg-red-600 hover:bg-red-700' : 'bg-zeus-accent hover:bg-zeus-accent-hover',
                !canSendMessage && !isStreaming ? 'bg-gray-600 cursor-not-allowed' : 'hover:scale-105'
              ]"
              aria-label="إرسال الرسالة"
            >
              <i :class="isStreaming ? 'fas fa-stop' : 'fas fa-paper-plane'"></i>
            </button>
          </div>
        </div>
        <div class="mt-2 text-xs text-gray-500 text-center">
            قد يرتكب زيوس اخطاء، الرجاء التحقق من المعلومات
        </div>
      </div>
    </div>
  `
};
