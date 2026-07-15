// ============================================
// ScreenEffects.js
// 螢幕演出特效：震動 / 閃光 / 染色。純 DOM + Web Animations API，
// 不依賴任何第三方。覆蓋層放在立繪之上、文字框之下（見 main.css .fx-*）。
// ============================================

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class ScreenEffects {
  constructor(screenEl) {
    this.screenEl = screenEl;
    this.overlay = document.createElement("div");
    this.overlay.className = "fx-overlay";

    this.tintEl = document.createElement("div");
    this.tintEl.className = "fx-tint";
    this.flashEl = document.createElement("div");
    this.flashEl.className = "fx-flash";

    this.overlay.appendChild(this.tintEl);   // 染色在下（持續）
    this.overlay.appendChild(this.flashEl);  // 閃光在上（瞬間）
    screenEl.appendChild(this.overlay);
  }

  // 震動整個畫面：intensity=位移像素峰值，duration=毫秒
  async shake({ intensity = 8, duration = 500 } = {}) {
    const steps = Math.max(6, Math.round(duration / 45));
    const frames = [];
    for (let i = 0; i <= steps; i++) {
      const decay = (1 - i / steps) * intensity;       // 隨時間衰減
      const dx = (Math.random() * 2 - 1) * decay;
      const dy = (Math.random() * 2 - 1) * decay;
      frames.push({ transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` });
    }
    frames.push({ transform: "translate(0, 0)" });
    try {
      const anim = this.screenEl.animate(frames, { duration, easing: "linear" });
      // 用 setTimeout 後備：背景分頁時 WAAPI 動畫會暫停，finished 不會解析
      await Promise.race([anim.finished, wait(duration + 100)]);
    } catch { /* 動畫被中斷 */ }
    this.screenEl.style.transform = "";
  }

  // 閃光：一層顏色從高不透明淡出到 0（瞬間）
  async flash({ color = "#ffffff", duration = 400 } = {}) {
    this.flashEl.style.background = color;
    try {
      const anim = this.flashEl.animate(
        [{ opacity: 0.92 }, { opacity: 0 }],
        { duration, easing: "ease-out" }
      );
      await Promise.race([anim.finished, wait(duration + 100)]);
    } catch { /* ignore */ }
    this.flashEl.style.opacity = "0";
  }

  // 染色：持續的色調覆蓋，直到再次呼叫或 clearTint
  tint({ color = "#000000", opacity = 0.4, duration = 600 } = {}) {
    this.tintEl.style.transition = `opacity ${duration}ms ease, background-color ${duration}ms ease`;
    this.tintEl.style.backgroundColor = color;
    // 強制 reflow 讓後續 opacity 變化能觸發 transition；
    // 用 reflow 而非 requestAnimationFrame，避免背景分頁 rAF 被暫停時失效。
    void this.tintEl.offsetWidth;
    this.tintEl.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  }

  clearTint({ duration = 600 } = {}) {
    this.tintEl.style.transition = `opacity ${duration}ms ease`;
    this.tintEl.style.opacity = "0";
  }

  // 立即清除所有特效（重新開始遊戲/預覽時用）
  reset() {
    this.screenEl.style.transform = "";
    this.flashEl.style.opacity = "0";
    this.tintEl.style.transition = "none";
    this.tintEl.style.opacity = "0";
  }
}
