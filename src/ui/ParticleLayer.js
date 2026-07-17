// ============================================
// ParticleLayer.js
// 粒子效果（S6e）：雪 / 雨 / 花瓣。Canvas 2D，無第三方依賴。
// 覆蓋在立繪之上、文字框之下（z-index 見 main.css .fx-particles）。
//
// 持續狀態：@particles 開啟直到 @particles-stop 或重建。
// step(dt) 獨立於 rAF 迴圈，測試可直接呼叫驗證運動。
// ============================================

const PRESETS = {
  snow:   { count: 60,  make: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.2, vy: 20 + Math.random() * 30, sway: 12 + Math.random() * 18, phase: Math.random() * Math.PI * 2, alpha: 0.5 + Math.random() * 0.5 }) },
  rain:   { count: 120, make: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 12, vy: 500 + Math.random() * 300, vx: -40 - Math.random() * 30, alpha: 0.25 + Math.random() * 0.3 }) },
  petals: { count: 40,  make: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, size: 4 + Math.random() * 5, vy: 40 + Math.random() * 40, sway: 30 + Math.random() * 30, phase: Math.random() * Math.PI * 2, rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 3, alpha: 0.6 + Math.random() * 0.4 }) },
};

export class ParticleLayer {
  constructor(containerEl) {
    // 重建 runtime 時清掉上一輪殘留的畫布
    containerEl.querySelectorAll(":scope > .fx-particles").forEach((el) => el.remove());

    this.containerEl = containerEl;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fx-particles";
    containerEl.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.type = null;
    this.parts = [];
    this._raf = null;
    this._last = 0;
  }

  /** 開啟粒子（會先停掉前一種）。type: snow | rain | petals */
  start(type, { density } = {}) {
    const preset = PRESETS[type];
    if (!preset) { this.stop(); return; }
    this.stop();
    this.type = type;
    this.density = density ?? null;   // 存檔快照用（null = 用預設）
    this.#resize();
    const n = Math.max(1, Math.round(density ?? preset.count));
    const { width: w, height: h } = this.canvas;
    this.parts = Array.from({ length: n }, () => preset.make(w, h));
    this._last = performance.now();
    const loop = (ts) => {
      const dt = Math.min(0.1, (ts - this._last) / 1000);   // 背景分頁回來時避免一次跳一大步
      this._last = ts;
      this.step(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this.type = null;
    this.parts = [];
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.stop();
    this.canvas.remove();
  }

  /** 前進 dt 秒並重繪。獨立成公開方法，rAF 迴圈與測試共用。 */
  step(dt) {
    if (!this.type) return;
    this.#resize();
    const { width: w, height: h } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    for (const p of this.parts) {
      p.y += p.vy * dt;
      if (this.type === "snow") {
        p.phase += dt;
        p.x += Math.sin(p.phase) * p.sway * dt;
        if (p.y > h + 5) { p.y = -5; p.x = Math.random() * w; }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === "rain") {
        p.x += p.vx * dt;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * (w + 80); }
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = "#9db8d8";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.03, p.y + p.len);
        ctx.stroke();
      } else if (this.type === "petals") {
        p.phase += dt;
        p.x += Math.sin(p.phase) * p.sway * dt;
        p.rot += p.vrot * dt;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = "#f4b8c8";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  #resize() {
    const w = this.containerEl.clientWidth || 1280;
    const h = this.containerEl.clientHeight || 720;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }
}
