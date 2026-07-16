// ============================================
// EndingManager.js
// 結局清單管理（產生玩家端的結局圖鑑），並比對劇本中
// 實際出現的 @ending，提示未登記項可一鍵加入。
// 常駐於「敘事地圖」頁左欄（結局是故事的終點節點，與敘事結構同屬一頁）。
// 原為資料庫 Hub 的「結局」分頁。
// ============================================

import { field, textInput, escapeHtml } from "../widgets/formFields.js";

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
    const list = document.createElement("div");
    list.className = "ending-list";
    for (let i = 0; i < endings.length; i++) {
      list.appendChild(this.#renderEndingRow(i, endings[i], actualIds));
    }
    if (endings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒定義結局。結局清單用來產生圖鑑。";
      list.appendChild(empty);
    }
    body.appendChild(list);

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn";
    addBtn.textContent = "+ 新增結局";
    addBtn.style.marginTop = "12px";
    addBtn.addEventListener("click", () => {
      const next = [...(this.project.storyMeta.endings || [])];
      next.push({ id: "", title: "", description: "" });
      this.#write(() => this.project.updateStoryMeta({ endings: next }));
      this.render();
    });
    body.appendChild(addBtn);

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

  #renderEndingRow(idx, ending, actualIds) {
    const row = document.createElement("div");
    row.className = "ending-row";

    const idUsed = ending.id && actualIds.has(ending.id);

    const header = document.createElement("div");
    header.className = "ending-row-header";
    header.innerHTML = `
      <span class="ending-num">結局 ${idx + 1}</span>
      ${idUsed ? '<span class="ending-used">✓ 已連結</span>' : '<span class="ending-unused">○ 未連結</span>'}
      <button class="ending-delete" title="刪除">×</button>
    `;
    header.querySelector(".ending-delete").addEventListener("click", () => {
      if (!confirm("刪除這個結局？")) return;
      const next = [...(this.project.storyMeta.endings || [])];
      next.splice(idx, 1);
      this.#write(() => this.project.updateStoryMeta({ endings: next }));
      this.render();   // index 會變，整面重繪
    });
    row.appendChild(header);

    const patch = (partial) => {
      const next = [...(this.project.storyMeta.endings || [])];
      next[idx] = { ...next[idx], ...partial };
      this.#write(() => this.project.updateStoryMeta({ endings: next }));
    };

    row.appendChild(field("ID", textInput({
      value: ending.id || "",
      placeholder: "ending_id",
      onChange: (v) => patch({ id: v }),
    })));

    row.appendChild(field("標題", textInput({
      value: ending.title || "",
      placeholder: "結局標題",
      onChange: (v) => patch({ title: v }),
    })));

    const descInput = document.createElement("textarea");
    descInput.value = ending.description || "";
    descInput.placeholder = "結局描述（顯示在圖鑑中）";
    descInput.rows = 2;
    descInput.addEventListener("change", () => patch({ description: descInput.value }));
    row.appendChild(field("描述", descInput));

    return row;
  }
}
