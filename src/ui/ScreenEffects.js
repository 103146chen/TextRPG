// ============================================
// ScreenEffects.js
// 螢幕演出特效：震動 / 閃光 / 染色 / 帷幕。純 DOM + Web Animations API，
// 不依賴任何第三方。覆蓋層放在立繪之上、文字框之下（見 main.css .fx-*）。
// 帷幕的 full 模式使用另一層（.fx-curtain-full），連文字框與選項一起蓋住。
// ============================================

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class ScreenEffects {
  constructor(screenEl) {
    this.screenEl = screenEl;

    // 預覽每次 load 都會重建 GameRuntime → ScreenEffects；
    // 先移除上一輪殘留的覆蓋層，避免一層層堆疊（舊染色/帷幕會卡在畫面上）。
    screenEl.querySelectorAll(":scope > .fx-overlay, :scope > .fx-curtain-full")
      .forEach((el) => el.remove());

    this.overlay = document.createElement("div");
    this.overlay.className = "fx-overlay";

    this.tintEl = document.createElement("div");
    this.tintEl.className = "fx-tint";
    this.vignetteEl = document.createElement("div");
    this.vignetteEl.className = "fx-vignette";
    this.curtainEl = document.createElement("div");
    this.curtainEl.className = "fx-curtain";
    this.flashEl = document.createElement("div");
    this.flashEl.className = "fx-flash";

    this.overlay.appendChild(this.tintEl);      // 染色在最下（持續）
    this.overlay.appendChild(this.vignetteEl);  // 暗角（持續，鏡頭氛圍）
    this.overlay.appendChild(this.curtainEl);   // 帷幕在中（持續，蓋過染色）
    this.overlay.appendChild(this.flashEl);     // 閃光在上（瞬間）
    screenEl.appendChild(this.overlay);

    // 全屏帷幕：在文字框之上（z-index 見 main.css）
    this.curtainFullEl = document.createElement("div");
    this.curtainFullEl.className = "fx-curtain-full";
    screenEl.appendChild(this.curtainFullEl);
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

  // 暗角（持續狀態）：radial-gradient 邊緣壓暗，opacity 0~1；0 = 關閉
  vignette({ opacity = 0.5, duration = 600 } = {}) {
    this.vignetteEl.style.transition = duration > 0 ? `opacity ${duration}ms ease` : "none";
    void this.vignetteEl.offsetWidth;
    this.vignetteEl.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  }

  clearTint({ duration = 600 } = {}) {
    this.tintEl.style.transition = `opacity ${duration}ms ease`;
    this.tintEl.style.opacity = "0";
  }

  /**
   * 帷幕（持續狀態）：close 合上一層純色遮罩、open 打開。
   * full=true 時使用全屏層（連文字框/選項一起蓋住），適合換幕。
   */
  curtain({ mode = "close", color = "#000000", duration = 600, full = false } = {}) {
    const apply = (el, show) => {
      el.style.transition = duration > 0 ? `opacity ${duration}ms ease` : "none";
      if (show) el.style.backgroundColor = color;
      void el.offsetWidth;
      el.style.opacity = show ? "1" : "0";
    };
    if (mode === "open") {
      apply(this.curtainEl, false);
      apply(this.curtainFullEl, false);
      return;
    }
    // close：兩層互斥，只留指定的那層
    apply(full ? this.curtainFullEl : this.curtainEl, true);
    apply(full ? this.curtainEl : this.curtainFullEl, false);
  }

  // 立即清除所有特效（重新開始遊戲/預覽時用）
  reset() {
    this.screenEl.style.transform = "";
    this.flashEl.style.opacity = "0";
    this.tintEl.style.transition = "none";
    this.tintEl.style.opacity = "0";
    this.curtainEl.style.transition = "none";
    this.curtainEl.style.opacity = "0";
    this.curtainFullEl.style.transition = "none";
    this.curtainFullEl.style.opacity = "0";
    this.vignetteEl.style.transition = "none";
    this.vignetteEl.style.opacity = "0";
  }
}
