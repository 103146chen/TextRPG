// ============================================
// TextBox.js
// 文字框顯示與打字機效果。
// S6a：@textcfg 可調整打字速度／每字淡入／等待圖標。
// ============================================

export class TextBox {
  constructor({ contentEl, speakerEl, indicatorEl }) {
    this.contentEl = contentEl;
    this.speakerEl = speakerEl;
    this.indicatorEl = indicatorEl;
    this.typingSpeed = 35;         // 毫秒/字
    this.fadeMs = 0;               // 每字淡入時長（0 = 關閉）
    this.showIndicator = true;     // 是否顯示等待圖標
    this.currentTimer = null;
    this.isTyping = false;
    this.currentFullText = "";
    this.onTypingComplete = null;
  }

  /**
   * @textcfg 的入口：只更新有給的欄位（持續狀態，直到再次設定）。
   * speed = 毫秒/字；fade = 每字淡入毫秒；indicator = 布林
   */
  configure({ speed, fade, indicator } = {}) {
    if (speed != null && !Number.isNaN(Number(speed))) this.typingSpeed = Math.max(0, Number(speed));
    if (fade != null && !Number.isNaN(Number(fade))) this.fadeMs = Math.max(0, Number(fade));
    if (indicator != null) this.showIndicator = !!indicator;
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
          if (this.showIndicator) this.indicatorEl.classList.add("show");
          this.onTypingComplete = resolve;
          return;
        }
        const ch = chars[idx];
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = ch;
        if (this.fadeMs > 0) {
          // 每字淡入：用強制 reflow 而非 rAF（背景分頁 rAF 會被暫停）
          span.style.opacity = "0";
          span.style.transition = `opacity ${this.fadeMs}ms ease`;
          this.contentEl.appendChild(span);
          void span.offsetWidth;
          span.style.opacity = "1";
        } else {
          this.contentEl.appendChild(span);
        }
        idx++;
        this.currentTimer = setTimeout(typeNext, this.typingSpeed);
      };
      typeNext();

    });
  }

  /**
   * 即時顯示（靜態求值用）：不跑打字機、不等待點擊。
   * 與 showText 的差別只在「呈現方式」，內容語意相同。
   */
  showInstant(speaker, text) {
    this.clearTimers();
    this.isTyping = false;
    this.onTypingComplete = null;
    this.currentFullText = text;
    this.speakerEl.textContent = speaker || "";
    this.contentEl.textContent = text;
    this.indicatorEl.classList.toggle("show", this.showIndicator);
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

  getPreview() {
    return this.currentFullText;
  }
}
