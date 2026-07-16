// ============================================
// FlagManager.js
// 變量（旗標）登記管理：型別／預設值／用途／說明，
// 以及「劇本用到但未登記」的一鍵補登。
// 常駐於「敘事地圖」頁的變量管理欄，與 FlagInspector（使用情況）同欄。
// 原為資料庫 Hub 的「旗標」分頁；S5 會在此基礎上加搜尋與篩選。
// ============================================

import { field, subLabel, escapeHtml } from "../widgets/formFields.js";

const EVENTS = new Set([
  "loaded", "flags-updated", "undo", "redo",
  // 這些會改變「未登記旗標」警告的內容
  "instructions-replaced", "instruction-updated", "instruction-inserted",
  "instruction-deleted", "scene-created", "scene-deleted",
]);

export class FlagManager {
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

  render() {
    this.containerEl.innerHTML = "";

    const head = document.createElement("div");
    head.className = "panel-header";
    head.innerHTML = `<span>旗標登記</span>`;
    this.containerEl.appendChild(head);

    if (!this.project.storyMeta) {
      this.containerEl.innerHTML += `<div class="panel-empty">開啟專案後可在此登記變量</div>`;
      return;
    }

    const flags = this.project.getDeclaredFlags();
    const names = Object.keys(flags);
    head.innerHTML = `<span>旗標登記</span><span class="panel-count">${names.length}</span>`;

    const body = document.createElement("div");
    body.className = "mgr-panel flag-mgr-body";

    const intro = subLabel("登記後，寫劇本（@set、選項、條件）時可下拉選取，並在開場套用預設值。");
    intro.style.display = "block";
    intro.style.marginBottom = "10px";
    body.appendChild(intro);

    const list = document.createElement("div");
    list.className = "flag-decl-list";
    if (names.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒登記任何旗標。";
      list.appendChild(empty);
    }
    for (const name of names) list.appendChild(this.#renderFlagRow(name, flags[name]));
    body.appendChild(list);

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn";
    addBtn.textContent = "+ 新增旗標";
    addBtn.style.marginTop = "12px";
    addBtn.addEventListener("click", () => {
      const name = prompt("旗標名稱（例：charm、met_alice）：", "");
      if (!name) return;
      if (this.project.getDeclaredFlags()[name]) { alert("旗標已存在"); return; }
      this.#write(() => this.project.upsertFlag(name, { type: "number", default: 0, label: "", usage: "counter" }));
      this.render();
    });
    body.appendChild(addBtn);

    // 劇本用到但未登記的旗標 → 一鍵補登
    const declared = new Set(names);
    const missing = [...this.project.collectUsedFlagNames()].filter((n) => !declared.has(n));
    if (missing.length > 0) {
      const warn = document.createElement("div");
      warn.className = "ending-warn";
      warn.innerHTML = `
        <strong>⚠ 劇本用到 ${missing.length} 個未登記旗標：</strong><br>
        ${missing.map((n) => `<code>${escapeHtml(n)}</code>`).join(", ")}
        <br><button class="tb-btn" style="margin-top:8px">一鍵登記</button>
      `;
      warn.querySelector("button").addEventListener("click", () => {
        this.#write(() => {
          for (const n of missing) this.project.upsertFlag(n, { type: "number", default: 0, label: "", usage: "counter" });
        });
        this.render();
      });
      body.appendChild(warn);
    }

    this.containerEl.appendChild(body);
  }

  #renderFlagRow(name, def) {
    const row = document.createElement("div");
    row.className = "flag-decl-row char-row";

    const header = document.createElement("div");
    header.className = "char-row-header";
    header.innerHTML = `<strong class="char-name">${escapeHtml(name)}</strong><button class="char-delete" title="刪除旗標登記">×</button>`;
    header.querySelector(".char-delete").addEventListener("click", () => {
      if (!confirm(`刪除旗標登記「${name}」？\n不會刪除劇本中的引用。`)) return;
      this.#write(() => this.project.removeFlag(name));
      this.render();
    });
    row.appendChild(header);

    const type = def.type || "number";

    const typeSel = document.createElement("select");
    for (const [val, txt] of [["number", "數值"], ["boolean", "是/否"], ["string", "文字"]]) {
      const o = document.createElement("option");
      o.value = val; o.textContent = txt;
      if (type === val) o.selected = true;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener("change", () => {
      const nd = { ...def, type: typeSel.value };
      if (typeSel.value === "number" && typeof nd.default !== "number") nd.default = 0;
      else if (typeSel.value === "boolean" && typeof nd.default !== "boolean") nd.default = false;
      else if (typeSel.value === "string" && typeof nd.default !== "string") nd.default = "";
      this.#write(() => this.project.upsertFlag(name, nd));
      this.render();   // 型別變了，預設值輸入元件要換
    });
    row.appendChild(field("型別", typeSel));

    let defInput;
    if (type === "boolean") {
      defInput = document.createElement("select");
      for (const [val, txt] of [["false", "否"], ["true", "是"]]) {
        const o = document.createElement("option");
        o.value = val; o.textContent = txt;
        if (String(def.default) === val) o.selected = true;
        defInput.appendChild(o);
      }
      defInput.addEventListener("change", () =>
        this.#write(() => this.project.upsertFlag(name, { ...def, default: defInput.value === "true" })));
    } else {
      defInput = document.createElement("input");
      defInput.type = type === "number" ? "number" : "text";
      defInput.value = def.default ?? (type === "number" ? 0 : "");
      defInput.addEventListener("change", () => {
        const v = type === "number" ? (parseFloat(defInput.value) || 0) : defInput.value;
        this.#write(() => this.project.upsertFlag(name, { ...def, default: v }));
      });
    }
    row.appendChild(field("預設值", defInput));

    // 用途（純標註，供變量管理篩選與檢查；不影響引擎）
    const usageSel = document.createElement("select");
    for (const [val, txt] of [["counter", "計數"], ["switch", "開關"], ["mark", "標記"], ["other", "其他"]]) {
      const o = document.createElement("option");
      o.value = val; o.textContent = txt;
      if ((def.usage || "counter") === val) o.selected = true;
      usageSel.appendChild(o);
    }
    usageSel.addEventListener("change", () =>
      this.#write(() => this.project.upsertFlag(name, { ...def, usage: usageSel.value })));
    row.appendChild(field("用途", usageSel));

    const labelInput = document.createElement("input");
    labelInput.value = def.label || "";
    labelInput.placeholder = "說明（例：好感度）";
    labelInput.addEventListener("change", () =>
      this.#write(() => this.project.upsertFlag(name, { ...def, label: labelInput.value })));
    row.appendChild(field("說明", labelInput));

    return row;
  }
}
