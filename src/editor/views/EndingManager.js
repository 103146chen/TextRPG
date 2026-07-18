// ============================================
// EndingManager.js
// 結局清單管理（產生玩家端的結局圖鑑），並比對劇本中
// 實際出現的 @ending，提示未登記項可一鍵加入。
// 常駐於「敘事地圖」頁左欄（結局是故事的終點節點，與敘事結構同屬一頁）。
// 原為資料庫 Hub 的「結局」分頁。
// ============================================

import { field, textInput, escapeHtml } from "../widgets/formFields.js";
import { confirmDialog } from "../widgets/dialog.js";

const EVENTS = new Set([
  "loaded", "story-meta-updated", "undo", "redo",
  // 這些會改變「已連結／未連結」與「未登記結局」的判定
  "instructions-replaced", "instruction-updated", "instruction-inserted",
  "instruction-deleted", "scene-created", "scene-deleted",
]);

export class EndingManager {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this._writing = false;
    this._selected = 0;   // 主從式：選中的結局索引
    this._unsub = project.subscribe((t) => {
      if (this._writing) return;
      if (EVENTS.has(t)) this.render();
    });
    this.render();
  }

  destroy() { this._unsub?.(); this.containerEl.innerHTML = ""; }

  #write(fn) { this._writing = true; try { fn(); } finally { this._writing = false; } }

  // 蒐集劇本中實際出現的 ending id
  #collectActualIds() {
    const ids = new Set();
    for (const sceneId of this.project.getAllSceneIds()) {
      const scene = this.project.getScene(sceneId);
      for (const ins of scene.instructions) {
        if (ins.type === "ending" && ins.id) ids.add(ins.id);
      }
    }
    return ids;
  }

  render() {
    this.containerEl.innerHTML = "";

    const head = document.createElement("div");
    head.className = "panel-header";
    head.innerHTML = `<span>結局</span>`;
    this.containerEl.appendChild(head);

    if (!this.project.storyMeta) {
      this.containerEl.innerHTML += `<div class="panel-empty">開啟專案後可在此管理結局</div>`;
      return;
    }

    const endings = this.project.storyMeta.endings || [];
    head.innerHTML = `<span>結局</span><span class="panel-count">${endings.length}</span>`;

    const body = document.createElement("div");
    body.className = "mgr-panel flag-mgr-body";

    const actualIds = this.#collectActualIds();

    // 解析選取
    if (this._selected >= endings.length) this._selected = endings.length - 1;
    if (this._selected < 0 && endings.length) this._selected = 0;

    const md = document.createElement("div");
    md.className = "mgr-md";

    // ---- 左：一覽 ----
    const listCol = document.createElement("div");
    listCol.className = "mgr-md-list";
    for (let i = 0; i < endings.length; i++) {
      listCol.appendChild(this.#renderListItem(i, endings[i], actualIds));
    }
    if (endings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒定義結局。結局清單用來產生圖鑑。";
      listCol.appendChild(empty);
    }
    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn mgr-md-add";
    addBtn.textContent = "+ 新增結局";
    addBtn.addEventListener("click", () => {
      const next = [...(this.project.storyMeta.endings || [])];
      next.push({ id: "", title: "", description: "" });
      this._selected = next.length - 1;
      this.#write(() => this.project.updateStoryMeta({ endings: next }));
      this.render();
    });
    listCol.appendChild(addBtn);
    md.appendChild(listCol);

    // ---- 右：細節 ----
    if (endings.length && this._selected >= 0) {
      md.appendChild(this.#renderDetail(this._selected, endings[this._selected], actualIds));
    } else {
      const empty = document.createElement("div");
      empty.className = "mgr-md-empty";
      empty.textContent = "從左側選擇一個結局以編輯，或新增一個。";
      md.appendChild(empty);
    }
    body.appendChild(md);

    // 劇本中有 @ending 但清單裡沒定義 → 一鍵加入
    const listedIds = new Set(endings.map((e) => e.id));
    const missing = [...actualIds].filter((id) => id && !listedIds.has(id));
    if (missing.length > 0) {
      const warn = document.createElement("div");
      warn.className = "ending-warn";
      warn.innerHTML = `
        <strong>⚠ 劇本中有 ${missing.length} 個結局未登記：</strong><br>
        ${missing.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}
        <br><button class="tb-btn" style="margin-top:8px">一鍵加入</button>
      `;
      warn.querySelector("button").addEventListener("click", () => {
        const next = [...(this.project.storyMeta.endings || [])];
        for (const id of missing) next.push({ id, title: id, description: "" });
        this.#write(() => this.project.updateStoryMeta({ endings: next }));
        this.render();
      });
      body.appendChild(warn);
    }

    this.containerEl.appendChild(body);
  }

  #renderListItem(idx, ending, actualIds) {
    const idUsed = ending.id && actualIds.has(ending.id);
    const item = document.createElement("div");
    item.className = "mgr-md-item" + (idx === this._selected ? " active" : "");

    const main = document.createElement("div");
    main.className = "mgr-md-item-main";
    main.innerHTML =
      `<div class="mgr-md-item-title">${escapeHtml(ending.title || `結局 ${idx + 1}`)}</div>` +
      `<div class="mgr-md-item-sub">${escapeHtml(ending.id || "（未設 ID）")}</div>`;
    item.appendChild(main);

    const badge = document.createElement("span");
    badge.className = "mgr-md-badge " + (idUsed ? "on" : "off");
    badge.textContent = idUsed ? "已連結" : "未連結";
    item.appendChild(badge);

    const del = document.createElement("button");
    del.className = "char-delete";
    del.title = "刪除結局";
    del.textContent = "×";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog({ title: "刪除這個結局？", confirmText: "刪除", danger: true }))) return;
      const next = [...(this.project.storyMeta.endings || [])];
      next.splice(idx, 1);
      if (this._selected >= next.length) this._selected = next.length - 1;
      this.#write(() => this.project.updateStoryMeta({ endings: next }));
      this.render();
    });
    item.appendChild(del);

    item.addEventListener("click", () => {
      if (this._selected === idx) return;
      this._selected = idx;
      this.render();
    });
    return item;
  }

  #renderDetail(idx, ending, actualIds) {
    const detail = document.createElement("div");
    detail.className = "mgr-md-detail";

    const idUsed = ending.id && actualIds.has(ending.id);
    const head = document.createElement("div");
    head.className = "char-md-detail-head";
    head.innerHTML = `<strong>${escapeHtml(ending.title || `結局 ${idx + 1}`)}</strong>` +
      `<span class="mgr-md-badge ${idUsed ? "on" : "off"}" style="margin-left:8px">${idUsed ? "已連結" : "未連結"}</span>`;
    detail.appendChild(head);

    const patch = (partial) => {
      const next = [...(this.project.storyMeta.endings || [])];
      next[idx] = { ...next[idx], ...partial };
      this.#write(() => this.project.updateStoryMeta({ endings: next }));
      // 標題/ID/連結狀態變化要反映到左欄 → 重繪
      this.render();
    };

    detail.appendChild(field("ID", textInput({
      value: ending.id || "",
      placeholder: "ending_id（對應劇本的 @ending id）",
      onChange: (v) => patch({ id: v }),
    })));

    detail.appendChild(field("標題", textInput({
      value: ending.title || "",
      placeholder: "結局標題",
      onChange: (v) => patch({ title: v }),
    })));

    const descInput = document.createElement("textarea");
    descInput.value = ending.description || "";
    descInput.placeholder = "結局描述（顯示在圖鑑中）";
    descInput.rows = 4;
    descInput.addEventListener("change", () => patch({ description: descInput.value }));
    detail.appendChild(field("描述", descInput));

    const note = document.createElement("div");
    note.className = "insp-note";
    note.textContent = idUsed
      ? "此結局的 ID 在劇本中有對應的 @ending，會出現在圖鑑。"
      : "劇本中尚無對應的 @ending id；玩家還無法解鎖此結局。";
    detail.appendChild(note);

    return detail;
  }
}
