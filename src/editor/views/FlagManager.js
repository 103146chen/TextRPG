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
import { usagesOf } from "../core/flagUsage.js";

const EVENTS = new Set([
  "loaded", "flags-updated", "undo", "redo",
  // 這些會改變「未登記旗標」警告的內容
  "instructions-replaced", "instruction-updated", "instruction-inserted",
  "instruction-deleted", "scene-created", "scene-deleted",
]);

const USAGE_LABELS = { counter: "計數", switch: "開關", mark: "標記", other: "其他" };

export class FlagManager {
  constructor(containerEl, project, onJumpTo) {
    this.containerEl = containerEl;
    this.project = project;
    this.onJumpTo = onJumpTo;   // (sceneId, index) → 跳到劇本該指令
    this._writing = false;
    this.search = "";          // 搜尋字串（名稱/說明）
    this.usageFilter = "all";  // all | counter | switch | mark | other
    this._selected = null;     // 主從式：選中的旗標名
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
    body.className = "mgr-panel mgr-wide flag-mgr-body";

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

    // ---- 主從式：左一覽（搜尋/篩選只重繪這一塊）｜ 右細節 ----
    const md = document.createElement("div");
    md.className = "mgr-md";

    const listCol = document.createElement("div");
    listCol.className = "mgr-md-list-col";
    this.listHost = document.createElement("div");
    listCol.appendChild(this.listHost);

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn mgr-md-add";
    addBtn.textContent = "+ 新增旗標";
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
      this._selected = name.trim();
      this.#write(() => this.project.upsertFlag(name.trim(), { type: "number", default: 0, label: "", usage: "counter" }));
      this.render();
    });
    listCol.appendChild(addBtn);
    md.appendChild(listCol);

    this.detailHost = document.createElement("div");
    this.detailHost.className = "mgr-md-detail";
    md.appendChild(this.detailHost);
    body.appendChild(md);

    this.#renderList();
    this.#renderDetail();

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

    // 解析選取：失效則退回第一個（篩選後的）
    if (this._selected && !flags[this._selected]) this._selected = null;
    if (!this._selected && names.length) this._selected = names[0];

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
    list.className = "mgr-md-list";
    if (names.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = total === 0 ? "還沒登記任何旗標。" : "沒有符合搜尋/篩選的旗標。";
      list.appendChild(empty);
    }
    for (const name of names) list.appendChild(this.#renderListItem(name, flags[name]));
    this.listHost.appendChild(list);
  }

  #renderListItem(name, def) {
    const item = document.createElement("div");
    item.className = "mgr-md-item" + (name === this._selected ? " active" : "");

    const main = document.createElement("div");
    main.className = "mgr-md-item-main";
    main.innerHTML =
      `<div class="mgr-md-item-title">${escapeHtml(name)}</div>` +
      (def.label ? `<div class="mgr-md-item-sub">${escapeHtml(def.label)}</div>` : "");
    item.appendChild(main);

    const tag = document.createElement("span");
    tag.className = "mgr-md-badge off";
    tag.textContent = USAGE_LABELS[def.usage || "counter"] || "計數";
    item.appendChild(tag);

    const del = document.createElement("button");
    del.className = "char-delete";
    del.title = "刪除旗標登記";
    del.textContent = "×";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog({
        title: `刪除旗標登記「${name}」？`,
        message: "不會刪除劇本中的引用。",
        confirmText: "刪除", danger: true,
      }))) return;
      if (this._selected === name) this._selected = null;
      this.#write(() => this.project.removeFlag(name));
      this.render();
    });
    item.appendChild(del);

    item.addEventListener("click", () => {
      if (this._selected === name) return;
      this._selected = name;
      this.#renderList();
      this.#renderDetail();
    });
    return item;
  }

  #renderDetail() {
    if (!this.detailHost) return;
    this.detailHost.innerHTML = "";
    const flags = this.project.getDeclaredFlags();
    const name = this._selected;
    if (!name || !flags[name]) {
      this.detailHost.innerHTML = `<div class="mgr-md-empty">從左側選擇一個旗標以編輯，或新增一個。</div>`;
      return;
    }
    let def = flags[name];

    const head = document.createElement("div");
    head.className = "char-md-detail-head";
    head.innerHTML = `<strong class="char-name">${escapeHtml(name)}</strong>`;
    this.detailHost.appendChild(head);

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
      this.#renderDetail();   // 型別變了，預設值輸入元件要換
    });
    this.detailHost.appendChild(field("型別", typeSel));

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
    this.detailHost.appendChild(field("預設值", defInput));

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
      this.#renderList();   // 左欄用途標籤更新
    });
    this.detailHost.appendChild(field("用途", usageSel));

    const labelInput = document.createElement("input");
    labelInput.value = def.label || "";
    labelInput.placeholder = "說明（例：好感度）";
    labelInput.addEventListener("change", () => {
      def = { ...def, label: labelInput.value };
      this.#write(() => this.project.upsertFlag(name, def));
      this.#renderList();   // 左欄副標題更新
    });
    this.detailHost.appendChild(field("說明", labelInput));

    // ---- 下方：此變量在劇本中的使用處 ----
    this.detailHost.appendChild(this.#renderUsages(name));
    return this.detailHost;
  }

  #renderUsages(name) {
    const { sets, reads } = usagesOf(this.project, name);
    const wrap = document.createElement("div");
    wrap.className = "flag-usages";

    const head = document.createElement("div");
    head.className = "flag-usages-head";
    head.innerHTML = `<strong>使用處</strong>` +
      `<span class="flag-usages-count">寫入 ${sets.length} ・ 讀取 ${reads.length}</span>`;
    wrap.appendChild(head);

    if (sets.length === 0 && reads.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "劇本中還沒有用到這個變量。";
      wrap.appendChild(empty);
      return wrap;
    }

    const section = (title, list, kind) => {
      if (!list.length) return;
      const t = document.createElement("div");
      t.className = "flag-usages-sub";
      t.textContent = title;
      wrap.appendChild(t);
      for (const loc of list) {
        const row = document.createElement("div");
        row.className = `flag-usage-row ${kind}`;
        row.innerHTML =
          `<span class="flag-ref-scene">${escapeHtml(loc.sceneId)}</span>` +
          `<span class="flag-ref-detail">${escapeHtml(loc.detail)}</span>`;
        row.title = "點擊跳到劇本中的這個位置";
        row.addEventListener("click", () => this.onJumpTo?.(loc.sceneId, loc.index));
        wrap.appendChild(row);
      }
    };
    section("寫入", sets, "set");
    section("讀取", reads, "read");
    return wrap;
  }
}
