// ============================================
// TextBox.js
// 文字框顯示與打字機效果
// ============================================

export class TextBox {
  constructor({ contentEl, speakerEl, indicatorEl }) {
    this.contentEl = contentEl;
    this.speakerEl = speakerEl;
    this.indicatorEl = indicatorEl;
    this.typingSpeed = 35;         // 毫秒/字
    this.currentTimer = null;
    this.isTyping = false;
    this.currentFullText = "";
    this.onTypingComplete = null;
  }

  /**
   * 顯示一段文字（打字機效果）
   * @returns Promise - 在玩家點擊或打字完成時 resolve
   */
  showText(speaker, text) {
    return new Promise((resolve) => {
      this.clearTimers();
      this.currentFullText = text;
      this.speakerEl.textContent = speaker || "";
      this.contentEl.innerHTML = "";
      this.indicatorEl.classList.remove("show");
      this.isTyping = true;

      const chars = [...text];
      let idx = 0;

      const typeNext = () => {
        if (idx >= chars.length) {
          this.isTyping = false;
          this.indicatorEl.classList.add("show");
          this.onTypingComplete = resolve;
          return;
        }
        const ch = chars[idx];
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = ch;
        this.contentEl.appendChild(span);
        idx++;
        this.currentTimer = setTimeout(typeNext, this.typingSpeed);
      };
      typeNext();

    });
  }

  handleClick() {
    if (this.isTyping) {
      return false; // 文字還沒跑完，點擊無效
    }
    if (this.onTypingComplete) {
      const cb = this.onTypingComplete;
      this.onTypingComplete = null;
      this.indicatorEl.classList.remove("show");
      cb();
      return true;
    }
    return false;
  }

  changeFontSize(delta) {
    // 預設字體大小大約為 20px，可以在 main.css 確認
    const currentSize = parseFloat(window.getComputedStyle(this.contentEl).fontSize) || 20;
    const newSize = Math.max(14, Math.min(48, currentSize + delta));
    this.contentEl.style.fontSize = `${newSize}px`;
  }

  clearTimers() {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
  }

  setSpeed(ms) { this.typingSpeed = ms; }

  #escape(s) {
    return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  getPreview() {
    return this.currentFullText;
  }
}
