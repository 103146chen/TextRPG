// ============================================
// PreviewPanel.js
// 編輯器內的即時預覽面板：右側停靠一個 iframe(preview.html)，
// 把記憶體中的專案（含未存檔變更）以 postMessage 送進去播放。
// ============================================

import { MarkdownWriter } from "../core/MarkdownWriter.js";

export class PreviewPanel {
  /**
   * @param {StoryProject} project
   * @param {object} [opts]
   * @param {HTMLElement} [opts.container] - 給定時「停靠」進該容器（常駐欄）；
   *   未給定則沿用原本的右側浮動 dock（可開關）。
   */
  constructor(project, { container = null } = {}) {
    this.project = project;
    this.iframe = null;
    this.ready = false;
    this.pendingStart = null;
    this.docked = !!container;
    this.#buildDom(container);
    window.addEventListener("message", (e) => this.#onMessage(e));
    // 常駐欄：一開始就建立 iframe（顯示 preview.html 的等待提示）
    if (this.docked) this.#ensureIframe();
  }

  #buildDom(container) {
    const panel = document.createElement("div");
    panel.id = "preview-panel";
    panel.style.cssText = this.docked
      ? "display:flex;flex-direction:column;height:100%;min-height:0;background:#000"
      : [
          "position:fixed", "top:0", "right:0", "width:46%", "max-width:760px",
          "height:100vh", "z-index:200", "display:none", "flex-direction:column",
          "box-shadow:-6px 0 28px rgba(0,0,0,0.45)", "background:#000",
        ].join(";");

    const header = document.createElement("div");
    header.style.cssText = [
      "display:flex", "align-items:center", "gap:8px", "padding:6px 10px",
      "background:#20232b", "color:#f5efe3", "font-size:13px",
      "font-family:system-ui,sans-serif", "flex:0 0 auto",
    ].join(";");
    header.innerHTML = `
      <span style="font-weight:600">即時預覽</span>
      <span style="opacity:.6;font-size:11px">反映未存檔的變更</span>
      <span style="flex:1"></span>
      <button data-act="run" style="cursor:pointer;background:#c0392b;color:#fff;border:0;border-radius:5px;padding:3px 12px;font-size:12px;font-weight:600">▶ 運行</button>
      <button data-act="restart" style="cursor:pointer;background:rgba(255,255,255,.14);color:#f5efe3;border:0;border-radius:5px;padding:3px 10px;font-size:12px" title="從場景開頭播放">⟳ 從頭</button>
      <button data-act="close" style="cursor:pointer;background:rgba(255,255,255,.14);color:#f5efe3;border:0;border-radius:5px;padding:3px 10px;font-size:12px">✕ 關閉</button>
    `;
    const closeBtn = header.querySelector('[data-act="close"]');
    if (this.docked) closeBtn.remove();          // 常駐欄不需要關閉
    else closeBtn.addEventListener("click", () => this.close());
    // ▶ 運行：從目前游標位置實際播放
    header.querySelector('[data-act="run"]').addEventListener("click", () => {
      if (this.pendingStart) this.play(this.pendingStart.sceneId, this.pendingStart.pc);
    });
    // ⟳ 從頭：從場景開頭實際播放
    header.querySelector('[data-act="restart"]').addEventListener("click", () => {
      if (this.pendingStart) this.play(this.pendingStart.sceneId, 0);
    });

    const wrap = document.createElement("div");
    wrap.style.cssText = "flex:1;position:relative;overflow:hidden";
    this.iframeWrap = wrap;

    panel.appendChild(header);
    panel.appendChild(wrap);
    (container || document.body).appendChild(panel);
    this.panel = panel;
  }

  #ensureIframe() {
    if (this.iframe) return;
    this.iframe = document.createElement("iframe");
    this.iframe.src = "./preview.html";
    this.iframe.style.cssText = "width:100%;height:100%;border:0;background:#000";
    this.iframeWrap.appendChild(this.iframe);
  }

  isOpen() {
    return this.docked || this.panel.style.display !== "none";
  }

  open() {
    if (!this.docked) this.panel.style.display = "flex";
    this.#ensureIframe();
  }

  close() {
    if (!this.docked) this.panel.style.display = "none";
  }

  /** 靜態預覽：只顯示執行到該指令時的畫面，不播放（跟隨游標用） */
  scrub(sceneId, pc = 0) {
    this.#request(sceneId, pc, "scrub");
  }

  /** 實際播放：從指定位置開始跑 */
  play(sceneId, pc = 0) {
    this.#request(sceneId, pc, "play");
  }

  #request(sceneId, pc, mode) {
    if (!sceneId) return;
    this.pendingStart = { sceneId, pc, mode };
    this.open();
    if (this.ready) this.#send();
    // 尚未 ready 時，等 preview:ready 訊息到達後由 #onMessage 觸發 #send
  }

  #buildData(startSceneId, startPc, mode) {
    const scenes = {};
    for (const id of this.project.getAllSceneIds()) {
      const sc = this.project.getScene(id);
      // 用 MarkdownWriter 從記憶體狀態產生 raw，確保反映未存檔變更
      scenes[id] = MarkdownWriter.write({ meta: sc.meta, instructions: sc.instructions },
        { characters: this.project.storyMeta?.characters || null });
    }
    return {
      type: "preview:load",
      storyMeta: this.project.storyMeta,
      scenes,
      startSceneId,
      startPc,
      mode,
    };
  }

  #send() {
    if (!this.pendingStart || !this.iframe) return;
    const { sceneId, pc, mode } = this.pendingStart;
    this.iframe.contentWindow.postMessage(this.#buildData(sceneId, pc, mode), "*");
  }

  async #onMessage(e) {
    const msg = e.data;
    if (!msg || typeof msg !== "object") return;
    // 只處理來自本面板 iframe 的訊息
    if (this.iframe && e.source !== this.iframe.contentWindow) return;

    if (msg.type === "preview:ready") {
      this.ready = true;
      this.#send();
    } else if (msg.type === "preview:asset-request") {
      const { reqId, kind, file } = msg;
      let blob = null;
      try {
        blob = await this.project.fs.readResource(kind, file);
      } catch { /* 找不到就回 null，讓引擎自己 fallback placeholder */ }
      this.iframe.contentWindow.postMessage({ type: "preview:asset-response", reqId, blob }, "*");
    }
  }
}
