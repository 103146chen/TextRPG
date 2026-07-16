// ============================================
// AssetPanel.js
// 資產管理面板：拖曳／挑選匯入背景、立繪、BGM、音效，
// 縮圖預覽與試聽，並可刪除。匯入後自動刷新各下拉選單。
// ============================================

const SECTIONS = [
  { kind: "backgrounds", label: "背景", accept: "image/*", type: "image" },
  { kind: "characters", label: "立繪", accept: "image/*", type: "image" },
  { kind: "bgm", label: "BGM", accept: "audio/*", type: "audio" },
  { kind: "se", label: "音效", accept: "audio/*", type: "audio" },
  { kind: "voice", label: "語音", accept: "audio/*", type: "audio" },
];

export class AssetPanel {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this.urlCache = new Map();   // "kind/file" -> objectURL（縮圖／試聽）
    this.currentAudio = null;

    // 資源變動時重繪
    this._unsub = this.project.subscribe((type) => {
      if (type === "resources-updated" || type === "loaded") this.render();
    });

    this.render();   // 初次渲染（未開專案時顯示提示）
  }

  // 卸載（Hub 分頁關閉時呼叫）：撤銷 object URL、取消訂閱
  destroy() {
    this._unsub?.();
    this.#revokeAll();
    this.containerEl.innerHTML = "";
  }

  render() {
    this.#revokeAll();
    this.containerEl.innerHTML = "";

    if (!this.project.storyMeta) {
      this.containerEl.innerHTML = `<div class="asset-empty">開啟專案後可在此管理資產</div>`;
      return;
    }

    // 一次算好游離清單，避免每個項目重算
    this.orphans = this.project.findOrphanAssets?.() || {};

    for (const sec of SECTIONS) {
      this.containerEl.appendChild(this.#renderSection(sec));
    }
  }

  #renderSection(sec) {
    const files = this.project.resources[sec.kind] || [];
    const wrap = document.createElement("div");
    wrap.className = "asset-section";

    const orphanCount = (this.orphans?.[sec.kind] || []).length;
    const head = document.createElement("div");
    head.className = "asset-section-head";
    head.innerHTML = `<span>${sec.label}</span><span class="asset-count">${files.length}</span>` +
      (orphanCount ? `<span class="asset-orphan-count" title="沒有任何地方引用">⚠ ${orphanCount} 個游離</span>` : "");

    // 匯入按鈕
    const importBtn = document.createElement("button");
    importBtn.className = "asset-import-btn";
    importBtn.textContent = "＋ 匯入";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = sec.accept;
    input.multiple = true;
    input.style.display = "none";
    input.addEventListener("change", () => {
      this.#importFiles(sec.kind, [...input.files]);
      input.value = "";
    });
    importBtn.addEventListener("click", () => input.click());
    head.appendChild(importBtn);
    head.appendChild(input);
    wrap.appendChild(head);

    // 拖曳放置區 + 縮圖網格
    const grid = document.createElement("div");
    grid.className = "asset-grid";
    grid.dataset.kind = sec.kind;

    if (files.length === 0) {
      const hint = document.createElement("div");
      hint.className = "asset-drop-hint";
      hint.textContent = `拖曳${sec.label}檔到這裡，或按「＋ 匯入」`;
      grid.appendChild(hint);
    } else {
      for (const file of files) grid.appendChild(this.#renderItem(sec, file));
    }

    // 拖放匯入
    grid.addEventListener("dragover", (e) => { e.preventDefault(); grid.classList.add("dragover"); });
    grid.addEventListener("dragleave", () => grid.classList.remove("dragover"));
    grid.addEventListener("drop", (e) => {
      e.preventDefault();
      grid.classList.remove("dragover");
      const dropped = [...(e.dataTransfer?.files || [])];
      if (dropped.length) this.#importFiles(sec.kind, dropped);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  #renderItem(sec, file) {
    const usages = this.project.findAssetUsages?.(sec.kind, file) || [];
    const isOrphan = usages.length === 0;

    const item = document.createElement("div");
    item.className = "asset-item" + (isOrphan ? " orphan" : "");
    item.title = isOrphan
      ? `${file}\n\n⚠ 沒有任何地方引用`
      : `${file}\n\n引用 ${usages.length} 處：\n` +
        usages.slice(0, 8).map((u) => `· ${u.sceneId ? u.sceneId + " → " : ""}${u.detail}`).join("\n") +
        (usages.length > 8 ? `\n…共 ${usages.length} 處` : "");

    if (sec.type === "image") {
      const img = document.createElement("img");
      img.className = "asset-thumb";
      img.alt = file;
      img.loading = "lazy";
      this.#resolveUrl(sec.kind, file).then((url) => { if (url) img.src = url; });
      item.appendChild(img);
    } else {
      const playBtn = document.createElement("button");
      playBtn.className = "asset-audio-btn";
      playBtn.textContent = "▶";
      playBtn.title = "試聽";
      playBtn.addEventListener("click", (e) => { e.stopPropagation(); this.#togglePlay(sec.kind, file, playBtn); });
      item.appendChild(playBtn);
    }

    const name = document.createElement("div");
    name.className = "asset-name";
    name.textContent = file;
    item.appendChild(name);

    const badge = document.createElement("div");
    badge.className = "asset-usage" + (isOrphan ? " orphan" : "");
    badge.textContent = isOrphan ? "⚠ 游離" : `${usages.length} 處引用`;
    item.appendChild(badge);

    const del = document.createElement("button");
    del.className = "asset-del";
    del.textContent = "×";
    del.title = "刪除";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      // 刪除前先講清楚影響範圍
      const warn = usages.length
        ? `「${file}」目前有 ${usages.length} 處引用：\n` +
          usages.slice(0, 6).map((u) => `· ${u.sceneId ? u.sceneId + " → " : ""}${u.detail}`).join("\n") +
          (usages.length > 6 ? `\n…共 ${usages.length} 處` : "") +
          `\n\n刪除後這些地方會找不到檔案。確定刪除？`
        : `刪除「${file}」？\n此檔案沒有任何地方引用。\n這會直接刪除檔案，無法復原。`;
      if (!confirm(warn)) return;
      await this.project.deleteAsset(sec.kind, file);
    });
    item.appendChild(del);

    return item;
  }

  async #importFiles(kind, files) {
    let ok = 0, fail = 0;
    for (const f of files) {
      try { await this.project.importAsset(kind, f); ok++; }
      catch (e) { console.error("匯入失敗", f?.name, e); fail++; }
    }
    if (fail) alert(`匯入完成：${ok} 成功、${fail} 失敗（詳見主控台）`);
  }

  #togglePlay(kind, file, btn) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      if (this.currentAudio.__btn) this.currentAudio.__btn.textContent = "▶";
      const wasSame = this.currentAudio.__key === `${kind}/${file}`;
      this.currentAudio = null;
      if (wasSame) return;
    }
    this.#resolveUrl(kind, file).then((url) => {
      if (!url) return;
      const audio = new Audio(url);
      audio.__btn = btn;
      audio.__key = `${kind}/${file}`;
      audio.addEventListener("ended", () => { btn.textContent = "▶"; if (this.currentAudio === audio) this.currentAudio = null; });
      audio.play().catch(() => {});
      btn.textContent = "❚❚";
      this.currentAudio = audio;
    });
  }

  async #resolveUrl(kind, file) {
    const key = `${kind}/${file}`;
    if (this.urlCache.has(key)) return this.urlCache.get(key);
    const blob = await this.project.fs.readResource(kind, file);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.urlCache.set(key, url);
    return url;
  }

  #revokeAll() {
    if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio = null; }
    for (const url of this.urlCache.values()) URL.revokeObjectURL(url);
    this.urlCache.clear();
  }
}
