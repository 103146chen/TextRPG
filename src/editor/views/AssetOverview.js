// ============================================
// AssetOverview.js
// 資產頁「總覽」：各類資產的數量、游離統計與快速入口。
// 點卡片直接切到該分類（onNavigate 由 main.js 提供）。
// ============================================

const KINDS = [
  { kind: "characters", label: "角色", icon: "🧍", view: "characters" },
  { kind: "backgrounds", label: "背景", icon: "🖼", view: "backgrounds" },
  { kind: "bgm", label: "BGM", icon: "🎵", view: "bgm" },
  { kind: "se", label: "音效", icon: "🔔", view: "se" },
  { kind: "voice", label: "語音", icon: "🎙", view: "voice" },
  { kind: "video", label: "視頻", icon: "🎬", view: "video" },
];

const EVENTS = new Set([
  "loaded", "resources-updated", "characters-updated", "positions-updated",
  // 游離統計取決於劇本引用
  "instructions-replaced", "instruction-updated", "instruction-inserted",
  "instruction-deleted", "scene-created", "scene-deleted", "undo", "redo",
]);

export class AssetOverview {
  constructor(containerEl, project, { onNavigate = null } = {}) {
    this.containerEl = containerEl;
    this.project = project;
    this.onNavigate = onNavigate;
    this._unsub = project.subscribe((t) => { if (EVENTS.has(t)) this.render(); });
    this.render();
  }

  destroy() { this._unsub?.(); this.containerEl.innerHTML = ""; }

  render() {
    this.containerEl.innerHTML = "";

    if (!this.project.storyMeta) {
      this.containerEl.innerHTML = `<div class="asset-empty">開啟專案後可在此檢視資產總覽</div>`;
      return;
    }

    const orphans = this.project.findOrphanAssets?.() || {};
    const grid = document.createElement("div");
    grid.className = "ov-grid";

    for (const k of KINDS) {
      const files = this.project.resources[k.kind] || [];
      const orphanCount = (orphans[k.kind] || []).length;
      grid.appendChild(this.#card({
        icon: k.icon,
        label: k.label,
        main: `${files.length} 個檔案`,
        sub: k.kind === "characters"
          ? `${Object.keys(this.project.storyMeta.characters || {}).length} 個角色定義`
          : (orphanCount ? `⚠ ${orphanCount} 個游離` : files.length ? "全部有引用" : ""),
        warn: orphanCount > 0 && k.kind !== "characters",
        view: k.view,
      }));
    }

    // 位置與錨點
    const posCount = Object.keys(this.project.getPositions?.() || {}).length;
    grid.appendChild(this.#card({
      icon: "🎯",
      label: "位置與錨點",
      main: `${posCount} 個自訂位置`,
      sub: "內建 left / center / right",
      warn: false,
      view: "positions",
    }));

    this.containerEl.appendChild(grid);

    // 游離總結（跨類別）
    const totalOrphans = Object.entries(orphans)
      .filter(([kind]) => kind !== "characters")   // 立繪為間接引用，總覽不當游離嚇人
      .reduce((s, [, list]) => s + list.length, 0);
    const note = document.createElement("div");
    note.className = "ov-note";
    note.textContent = totalOrphans
      ? `共 ${totalOrphans} 個資產沒有任何引用（各分類內有標示，刪除前會列出影響範圍）。`
      : "所有背景 / 音訊 / 視頻資產都有被劇本引用。";
    this.containerEl.appendChild(note);
  }

  #card({ icon, label, main, sub, warn, view }) {
    const card = document.createElement("button");
    card.className = "ov-card" + (warn ? " warn" : "");
    card.innerHTML = `
      <span class="ov-icon">${icon}</span>
      <span class="ov-label">${label}</span>
      <span class="ov-main">${main}</span>
      <span class="ov-sub">${sub || ""}</span>
    `;
    card.addEventListener("click", () => this.onNavigate?.(view));
    return card;
  }
}
