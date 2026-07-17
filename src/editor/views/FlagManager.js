// ============================================
// FlagManager.js
// 變量（旗標）管理：登記 CRUD ＋ 搜尋 ＋ 用途/型別篩選（S5）。
// 常駐於「敘事地圖」頁的變量管理欄，與 FlagInspector（使用情況）同欄。
//
// 搜尋與篩選只重繪清單區（#renderList），不動搜尋框本身——
// 否則每敲一個字輸入框就被重建、焦點消失。
// ============================================

import { field, subLabel, escapeHtml } from "../widgets/formFields.js";
import { promptDialog, confirmDialog } from "../widgets/dialog.js";

const EVENTS = new Set([
  "loaded", "flags-updated", "undo", "redo",
  // 這些會改變「未登記旗標」警告的內容
  "instructions-replaced", "instruction-updated", "instruction-inserted",
  "instruction-deleted", "scene-created", "scene-deleted",
]);

const USAGE_LABELS = { counter: "計數", switch: "開關", mark: "標記", other: "其他" };

export class FlagManager {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this._writing = false;
    this.search = "";          // 搜尋字串（名稱/說明）
    this.usageFilter = "all";  // all | counter | switch | mark | other
    this._unsub = project.subscribe((t) => {
      if (this._writing) return;
      if (EVENTS.has(t)) this.render();
    });
    this.render();
  }

  destroy() { this._unsub?.(); this.containerEl.innerHTML = ""; }

  #write(fn) { this._writing = true; try { fn(); } finally { this._writing = false; } }

  #filtered() {
    const flags = this.project.getDeclaredFlags();
    const q = this.search.trim().toLowerCase();
    return Object.keys(flags).filter((name) => {
      const def = flags[name];
      if (this.usageFilter !== "all" && (def.usage || "counter") !== this.usageFilter) return false;
      if (!q) return true;
      return name.toLowerCase().includes(q) ||
             String(def.label || "").toLowerCase().includes(q);
    });
  }

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

    const total = Object.keys(this.project.getDeclaredFlags()).length;
    head.innerHTML = `<span>旗標登記</span><span class="panel-count">${total}</span>`;

    const body = document.createElement("div");
    body.className = "mgr-panel flag-mgr-body";

    // ---- 搜尋 + 篩選（S5）----
    const controls = document.createElement("div");
    controls.className = "flag-controls";

    const searchIn = document.createElement("input");
    searchIn.type = "search";
    searchIn.placeholder = "搜尋名稱或說明…";
    searchIn.value = this.search;
    searchIn.addEventListener("input", () => {
      this.search = searchIn.value;
      this.#renderList();
    });
    controls.appendChild(searchIn);

    const usageSel = document.createElement("select");
    for (const [val, txt] of [["all", "全部用途"], ["counter", "計數"], ["switch", "開關"], ["mark", "標記"], ["other", "其他"]]) {
      const o = document.createElement("option");
      o.value = val; o.textContent = txt;
      if (this.usageFilter === val) o.selected = true;
      usageSel.appendChild(o);
    }
    usageSel.addEventListener("change", () => {
      this.usageFilter = usageSel.value;
      this.#renderList();
    });
    controls.appendChild(usageSel);
    body.appendChild(controls);

    // ---- 清單區（搜尋/篩選只重繪這一塊）----
    this.listHost = document.createElement("div");
    body.appendChild(this.listHost);
    this.#renderList();

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn";
    addBtn.textContent = "+ 新增旗標";
    addBtn.style.marginTop = "12px";
    addBtn.addEventListener("click", async () => {
      const name = await promptDialog({
        title: "新增旗標",
        label: "旗標名稱",
        placeholder: "例：charm、met_alice",
        validate: (v) => {
          if (!v.trim()) return "請輸入旗標名稱";
          if (this.project.getDeclaredFlags()[v.trim()]) return "旗標已存在";
          return null;
        },
      });
      if (name === null) return;
      this.#write(() => this.project.upsertFlag(name.trim(), { type: "number", default: 0, label: "", usage: "counter" }));
      this.render();
    });
    body.appendChild(addBtn);

    // 劇本用到但未登記的旗標 → 一鍵補登（不受搜尋/篩選影響）
    const declared = new Set(Object.keys(this.project.getDeclaredFlags()));
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

  #renderList() {
    this.listHost.innerHTML = "";
    const flags = this.project.getDeclaredFlags();
    const names = this.#filtered();
    const total = Object.keys(flags).length;
    const filtering = this.search.trim() !== "" || this.usageFilter !== "all";

    if (filtering) {
      const info = subLabel(`顯示 ${names.length} / ${total} 個`);
      info.style.display = "block";
      info.style.marginBottom = "8px";
      this.listHost.appendChild(info);
    } else if (total === 0) {
      const intro = subLabel("登記後，寫劇本（@set、選項、條件）時可下拉選取，並在開場套用預設值。");
      intro.style.display = "block";
      intro.style.marginBottom = "10px";
      this.listHost.appendChild(intro);
    }

    const list = document.createElement("div");
    list.className = "flag-decl-list";
    if (names.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = total === 0 ? "還沒登記任何旗標。" : "沒有符合搜尋/篩選的旗標。";
      list.appendChild(empty);
    }
    for (const name of names) list.appendChild(this.#renderFlagRow(name, flags[name]));
    this.listHost.appendChild(list);
  }

  #renderFlagRow(name, def) {
    const row = document.createElement("div");
    row.className = "flag-decl-row char-row";

    const header = document.createElement("div");
    header.className = "char-row-header";
    const usageTag = USAGE_LABELS[def.usage || "counter"] || "計數";
    header.innerHTML =
      `<strong class="char-name">${escapeHtml(name)}</strong>` +
      `<span class="flag-usage-tag">${usageTag}</span>` +
      `<button class="char-delete" title="刪除旗標登記">×</button>`;
    header.querySelector(".char-delete").addEventListener("click", async () => {
      if (!(await confirmDialog({
        title: `刪除旗標登記「${name}」？`,
        message: "不會刪除劇本中的引用。",
        confirmText: "刪除", danger: true,
      }))) return;
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
      this.#renderList();   // 型別變了，預設值輸入元件要換
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
      defInput.addEventListener("change", () => {
        def = { ...def, default: defInput.value === "true" };
        this.#write(() => this.project.upsertFlag(name, def));
      });
    } else {
      defInput = document.createElement("input");
      defInput.type = type === "number" ? "number" : "text";
      defInput.value = def.default ?? (type === "number" ? 0 : "");
      defInput.addEventListener("change", () => {
        const v = type === "number" ? (parseFloat(defInput.value) || 0) : defInput.value;
        def = { ...def, default: v };
        this.#write(() => this.project.upsertFlag(name, def));
      });
    }
    row.appendChild(field("預設值", defInput));

    // 用途（純標註，供篩選與檢查；不影響引擎）
    const usageSel = document.createElement("select");
    for (const [val, txt] of Object.entries(USAGE_LABELS)) {
      const o = document.createElement("option");
      o.value = val; o.textContent = txt;
      if ((def.usage || "counter") === val) o.selected = true;
      usageSel.appendChild(o);
    }
    usageSel.addEventListener("change", () => {
      def = { ...def, usage: usageSel.value };
      this.#write(() => this.project.upsertFlag(name, def));
      // 更新列首的用途標籤（不整列重建，保住焦點）
      header.querySelector(".flag-usage-tag").textContent = USAGE_LABELS[usageSel.value];
    });
    row.appendChild(field("用途", usageSel));

    const labelInput = document.createElement("input");
    labelInput.value = def.label || "";
    labelInput.placeholder = "說明（例：好感度）";
    labelInput.addEventListener("change", () => {
      def = { ...def, label: labelInput.value };
      this.#write(() => this.project.upsertFlag(name, def));
    });
    row.appendChild(field("說明", labelInput));

    return row;
  }
}
