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

      // 允許「點擊立即完成並前進」（一次點擊 = 跳完打字 + 前進）
      this.skipToEnd = () => {
        this.clearTimers();
        this.contentEl.innerHTML = chars
          .map(c => `<span class="char" style="opacity:1">${this.#escape(c)}</span>`)
          .join("");
        this.isTyping = false;
        this.indicatorEl.classList.add("show");
        this.onTypingComplete = resolve;
      };
    });
  }

  /**
   * 玩家點擊：
   *   打字中 → 立即跳完並前進（一次點擊，不需要第二次）
   *   打字已完成 → 直接前進
   * 返回 true 時呼叫者應呼叫 engine.advance()
   */
  handleClick() {
    if (this.isTyping && this.skipToEnd) {
      // 跳完打字，立即也 resolve（一次點擊前進）
      this.skipToEnd();
      if (this.onTypingComplete) {
        const cb = this.onTypingComplete;
        this.onTypingComplete = null;
        this.indicatorEl.classList.remove("show");
        cb();
        return true;
      }
      return false;
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
