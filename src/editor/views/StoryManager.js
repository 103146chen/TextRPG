// ============================================
// StoryManager.js
// 專案資料庫 Hub：統一管理 基本 / 角色 / 旗標 / 資產 / 結局。
// 供編輯欄位的「＋ 新增」以 open(tab) 快速跳轉進來。
// ============================================

import { AssetPanel } from "./AssetPanel.js";

export class StoryManager {
  constructor(project) {
    this.project = project;
    this.dialogEl = null;
    this._thumbUrls = [];   // 縮圖 objectURL，關閉時一併撤銷
  }

  // 非同步把某個立繪縮圖填進 img（找不到就顯示 placeholder 樣式）
  #fillThumb(img, file) {
    img.classList.add("char-thumb");
    if (!file) { img.classList.add("empty"); return; }
    this.project.fs?.readResource?.("characters", file).then((blob) => {
      if (!blob) { img.classList.add("empty"); return; }
      const url = URL.createObjectURL(blob);
      this._thumbUrls.push(url);
      img.src = url;
    }).catch(() => img.classList.add("empty"));
  }

  open(activeTab = "basic") {
    this.close();
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.close();
    });

    const dialog = document.createElement("div");
    dialog.className = "dialog story-manager-dialog";
    dialog.addEventListener("click", (e) => e.stopPropagation());

    dialog.innerHTML = `
      <div class="dialog-tabs">
        <button class="tab-btn active" data-tab="basic">基本資訊</button>
        <button class="tab-btn" data-tab="characters">角色</button>
        <button class="tab-btn" data-tab="flags">旗標</button>
        <button class="tab-btn" data-tab="assets">資產</button>
        <button class="tab-btn" data-tab="endings">結局</button>
      </div>
      <div class="dialog-body">
        <div class="tab-panel" data-panel="basic"></div>
        <div class="tab-panel" data-panel="characters" style="display:none"></div>
        <div class="tab-panel" data-panel="flags" style="display:none"></div>
        <div class="tab-panel" data-panel="assets" style="display:none"></div>
        <div class="tab-panel" data-panel="endings" style="display:none"></div>
      </div>
      <div class="dialog-actions">
        <button class="tb-btn primary" data-close>完成</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    this.dialogEl = overlay;

    // Tab 切換
    dialog.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        dialog.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        dialog.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
        dialog.querySelector(`[data-panel="${btn.dataset.tab}"]`).style.display = "";
      });
    });

    // 關閉
    dialog.querySelector("[data-close]").addEventListener("click", () => this.close());

    // 渲染各 panel
    this.#renderBasicPanel(dialog.querySelector('[data-panel="basic"]'));
    this.#renderCharactersPanel(dialog.querySelector('[data-panel="characters"]'));
    this.#renderFlagsPanel(dialog.querySelector('[data-panel="flags"]'));
    this.#renderAssetsPanel(dialog.querySelector('[data-panel="assets"]'));
    this.#renderEndingsPanel(dialog.querySelector('[data-panel="endings"]'));

    // 開啟指定分頁
    if (activeTab && activeTab !== "basic") {
      dialog.querySelector(`.tab-btn[data-tab="${activeTab}"]`)?.click();
    }
  }

  close() {
    if (this.assetPanel) { this.assetPanel.destroy(); this.assetPanel = null; }
    for (const u of this._thumbUrls) URL.revokeObjectURL(u);
    this._thumbUrls = [];
    if (this.dialogEl) {
      this.dialogEl.remove();
      this.dialogEl = null;
    }
  }

  // ==================== Basic ====================

  #renderBasicPanel(el) {
    const meta = this.project.storyMeta;
    el.innerHTML = "";

    el.appendChild(this.#field("故事 ID", this.#input({
      value: meta.id || "",
      placeholder: "my_story",
      readonly: true,
      help: "由資料夾名稱決定，不能修改",
    })));

    el.appendChild(this.#field("標題", this.#input({
      value: meta.title || "",
      placeholder: "故事標題",
      onChange: (v) => this.project.updateStoryMeta({ title: v }),
    })));

    el.appendChild(this.#field("副標題", this.#input({
      value: meta.subtitle || "",
      placeholder: "副標題（選用）",
      onChange: (v) => this.project.updateStoryMeta({ subtitle: v || undefined }),
    })));

    el.appendChild(this.#field("作者", this.#input({
      value: meta.author || "",
      placeholder: "作者名",
      onChange: (v) => this.project.updateStoryMeta({ author: v || undefined }),
    })));

    el.appendChild(this.#field("版本", this.#input({
      value: meta.version || "1.0.0",
      placeholder: "1.0.0",
      onChange: (v) => this.project.updateStoryMeta({ version: v || undefined }),
    })));

    // Start 場景
    const sceneIds = this.project.getAllSceneIds();
    const startSelect = document.createElement("select");
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "（選擇起始場景）";
    startSelect.appendChild(emptyOpt);
    for (const id of sceneIds) {
      const opt = document.createElement("option");
      opt.value = id;
      const sc = this.project.getScene(id);
      opt.textContent = sc.meta.title ? `${sc.meta.title} (${id})` : id;
      if (id === meta.start) opt.selected = true;
      startSelect.appendChild(opt);
    }
    startSelect.addEventListener("change", () => {
      this.project.updateStoryMeta({ start: startSelect.value });
    });
    el.appendChild(this.#field("起始場景", startSelect));
  }

  // ==================== Characters ====================

  #renderCharactersPanel(el) {
    el.innerHTML = "";

    const chars = this.project.storyMeta.characters || {};

    const charList = document.createElement("div");
    charList.className = "char-list";

    for (const [name, data] of Object.entries(chars)) {
      charList.appendChild(this.#renderCharacterRow(name, data));
    }

    if (Object.keys(chars).length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒定義任何角色";
      charList.appendChild(empty);
    }

    el.appendChild(charList);

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn";
    addBtn.textContent = "+ 新增角色";
    addBtn.style.marginTop = "16px";
    addBtn.addEventListener("click", () => {
      const name = prompt("新角色的名稱：", "");
      if (!name) return;
      if (chars[name]) {
        alert("角色已存在");
        return;
      }
      this.project.upsertCharacter(name, {
        default: "",
        emotions: {},
      });
      this.#renderCharactersPanel(el);
    });
    el.appendChild(addBtn);
  }

  #renderCharacterRow(name, data) {
    const row = document.createElement("div");
    row.className = "char-row";

    const charResources = this.project.resources.characters;

    // 名字 + 刪除按鈕
    const header = document.createElement("div");
    header.className = "char-row-header";
    header.innerHTML = `
      <strong class="char-name">${escapeHtml(name)}</strong>
      <button class="char-delete" title="刪除角色">×</button>
    `;
    header.querySelector(".char-delete").addEventListener("click", () => {
      if (!confirm(`刪除角色「${name}」？\n這不會刪除劇本中對這個角色的引用。`)) return;
      this.project.removeCharacter(name);
      row.remove();
    });
    row.appendChild(header);

    // 預設立繪（含縮圖）
    const defWrap = document.createElement("div");
    defWrap.className = "char-field";
    defWrap.appendChild(this.#labelText("預設立繪"));
    const defRow = document.createElement("div");
    defRow.className = "char-thumb-row";
    const defImg = document.createElement("img");
    this.#fillThumb(defImg, data.default);
    defRow.appendChild(defImg);
    const defInput = this.#datalistInput({
      value: data.default || "",
      options: charResources,
      placeholder: "檔名，例 alice_normal.png",
      onChange: (v) => {
        data.default = v;
        this.project.upsertCharacter(name, data);
        this.#fillThumb(defImg, v);   // 立即換縮圖
      }
    });
    defRow.appendChild(defInput);
    defWrap.appendChild(defRow);
    row.appendChild(defWrap);

    // 表情清單
    const emoSection = document.createElement("div");
    emoSection.className = "char-emotions";
    const emoTitle = document.createElement("div");
    emoTitle.className = "char-section-label";
    emoTitle.textContent = "表情";
    emoSection.appendChild(emoTitle);

    const emoList = document.createElement("div");
    emoList.className = "emotion-list";
    const emotions = data.emotions || {};
    for (const [emoName, emoFile] of Object.entries(emotions)) {
      emoList.appendChild(this.#renderEmotionRow(name, data, emoName, emoFile, charResources));
    }
    emoSection.appendChild(emoList);

    const addEmoBtn = document.createElement("button");
    addEmoBtn.className = "emotion-add";
    addEmoBtn.textContent = "+ 新表情";
    addEmoBtn.addEventListener("click", () => {
      const emoName = prompt("表情名稱（例：happy、sad）：", "");
      if (!emoName) return;
      if (!data.emotions) data.emotions = {};
      if (data.emotions[emoName]) { alert("這個表情已存在"); return; }
      data.emotions[emoName] = "";
      this.project.upsertCharacter(name, data);
      // 重繪
      const parent = emoList.parentElement.parentElement;
      this.#renderCharactersPanel(parent.parentElement);
    });
    emoSection.appendChild(addEmoBtn);
    row.appendChild(emoSection);

    return row;
  }

  #renderEmotionRow(charName, charData, emoName, emoFile, charResources) {
    const row = document.createElement("div");
    row.className = "emotion-row";

    const thumb = document.createElement("img");
    this.#fillThumb(thumb, emoFile);
    row.appendChild(thumb);

    const label = document.createElement("span");
    label.className = "emotion-name";
    label.textContent = emoName;
    row.appendChild(label);

    const input = this.#datalistInput({
      value: emoFile || "",
      options: charResources,
      placeholder: "檔名",
      onChange: (v) => {
        charData.emotions[emoName] = v;
        this.project.upsertCharacter(charName, charData);
        this.#fillThumb(thumb, v);   // 立即換縮圖
      }
    });
    input.style.flex = "1";
    row.appendChild(input);

    const delBtn = document.createElement("button");
    delBtn.className = "emotion-delete";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => {
      delete charData.emotions[emoName];
      this.project.upsertCharacter(charName, charData);
      row.remove();
    });
    row.appendChild(delBtn);

    return row;
  }

  // ==================== Flags（旗標登記）====================

  #renderFlagsPanel(el) {
    el.innerHTML = "";
    const flags = this.project.getDeclaredFlags();
    const names = Object.keys(flags);

    const intro = document.createElement("div");
    intro.className = "sm-sub-label";
    intro.style.marginBottom = "10px";
    intro.textContent = "登記旗標後，寫劇本（@set、選項、條件）時就能用下拉選取，並在開場套用預設值。";
    el.appendChild(intro);

    const list = document.createElement("div");
    list.className = "flag-decl-list";
    if (names.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒登記任何旗標。";
      list.appendChild(empty);
    }
    for (const name of names) list.appendChild(this.#renderFlagRow(name, flags[name]));
    el.appendChild(list);

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn";
    addBtn.textContent = "+ 新增旗標";
    addBtn.style.marginTop = "16px";
    addBtn.addEventListener("click", () => {
      const name = prompt("旗標名稱（例：charm、met_alice）：", "");
      if (!name) return;
      if (flags[name]) { alert("旗標已存在"); return; }
      this.project.upsertFlag(name, { type: "number", default: 0, label: "", usage: "counter" });
      this.#renderFlagsPanel(el);
    });
    el.appendChild(addBtn);

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
        for (const n of missing) this.project.upsertFlag(n, { type: "number", default: 0, label: "", usage: "counter" });
        this.#renderFlagsPanel(el);
      });
      el.appendChild(warn);
    }
  }

  #renderFlagRow(name, def) {
    const row = document.createElement("div");
    row.className = "flag-decl-row char-row";

    const header = document.createElement("div");
    header.className = "char-row-header";
    header.innerHTML = `<strong class="char-name">${escapeHtml(name)}</strong><button class="char-delete" title="刪除旗標登記">×</button>`;
    header.querySelector(".char-delete").addEventListener("click", () => {
      if (!confirm(`刪除旗標登記「${name}」？\n不會刪除劇本中的引用。`)) return;
      this.project.removeFlag(name);
      row.remove();
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
      this.project.upsertFlag(name, nd);
      this.#renderFlagsPanel(row.closest('[data-panel="flags"]'));
    });
    row.appendChild(this.#field("型別", typeSel));

    let defInput;
    if (type === "boolean") {
      defInput = document.createElement("select");
      for (const [val, txt] of [["false", "否"], ["true", "是"]]) {
        const o = document.createElement("option");
        o.value = val; o.textContent = txt;
        if (String(def.default) === val) o.selected = true;
        defInput.appendChild(o);
      }
      defInput.addEventListener("change", () => this.project.upsertFlag(name, { ...def, default: defInput.value === "true" }));
    } else {
      defInput = document.createElement("input");
      defInput.type = type === "number" ? "number" : "text";
      defInput.value = def.default ?? (type === "number" ? 0 : "");
      defInput.addEventListener("change", () => {
        const v = type === "number" ? (parseFloat(defInput.value) || 0) : defInput.value;
        this.project.upsertFlag(name, { ...def, default: v });
      });
    }
    row.appendChild(this.#field("預設值", defInput));

    // 用途（純標註，供變量管理篩選與檢查；不影響引擎）
    const usageSel = document.createElement("select");
    for (const [val, txt] of [["counter", "計數"], ["switch", "開關"], ["mark", "標記"], ["other", "其他"]]) {
      const o = document.createElement("option");
      o.value = val; o.textContent = txt;
      if ((def.usage || "counter") === val) o.selected = true;
      usageSel.appendChild(o);
    }
    usageSel.addEventListener("change", () => this.project.upsertFlag(name, { ...def, usage: usageSel.value }));
    row.appendChild(this.#field("用途", usageSel));

    const labelInput = document.createElement("input");
    labelInput.value = def.label || "";
    labelInput.placeholder = "說明（例：好感度）";
    labelInput.addEventListener("change", () => this.project.upsertFlag(name, { ...def, label: labelInput.value }));
    row.appendChild(this.#field("說明", labelInput));

    return row;
  }

  // ==================== Assets（重用 AssetPanel）====================

  #renderAssetsPanel(el) {
    el.innerHTML = "";
    const host = document.createElement("div");
    host.className = "hub-asset-host";
    el.appendChild(host);
    if (this.assetPanel) this.assetPanel.destroy();
    this.assetPanel = new AssetPanel(host, this.project);
  }

  // ==================== Endings ====================

  #renderEndingsPanel(el) {
    el.innerHTML = "";

    const endings = this.project.storyMeta.endings || [];
    const list = document.createElement("div");
    list.className = "ending-list";

    // 蒐集劇本中實際出現的 ending id
    const actualIds = new Set();
    for (const sceneId of this.project.getAllSceneIds()) {
      const scene = this.project.getScene(sceneId);
      for (const ins of scene.instructions) {
        if (ins.type === "ending" && ins.id) actualIds.add(ins.id);
      }
    }

    for (let i = 0; i < endings.length; i++) {
      list.appendChild(this.#renderEndingRow(i, endings[i], actualIds));
    }

    if (endings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒定義結局。結局清單用來產生圖鑑。";
      list.appendChild(empty);
    }

    el.appendChild(list);

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn";
    addBtn.textContent = "+ 新增結局";
    addBtn.style.marginTop = "16px";
    addBtn.addEventListener("click", () => {
      const endings = [...(this.project.storyMeta.endings || [])];
      endings.push({ id: "", title: "", description: "" });
      this.project.updateStoryMeta({ endings });
      this.#renderEndingsPanel(el);
    });
    el.appendChild(addBtn);

    // 若劇本中有 ending id 但清單裡沒定義，提示
    const listedIds = new Set(endings.map(e => e.id));
    const missing = [...actualIds].filter(id => id && !listedIds.has(id));
    if (missing.length > 0) {
      const warn = document.createElement("div");
      warn.className = "ending-warn";
      warn.innerHTML = `
        <strong>⚠ 劇本中有 ${missing.length} 個結局未登記：</strong><br>
        ${missing.map(id => `<code>${escapeHtml(id)}</code>`).join(", ")}
        <br>
        <button class="tb-btn" style="margin-top:8px">一鍵加入</button>
      `;
      warn.querySelector("button").addEventListener("click", () => {
        const newEndings = [...(this.project.storyMeta.endings || [])];
        for (const id of missing) {
          newEndings.push({ id, title: id, description: "" });
        }
        this.project.updateStoryMeta({ endings: newEndings });
        this.#renderEndingsPanel(el);
      });
      el.appendChild(warn);
    }
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
      const endings = [...(this.project.storyMeta.endings || [])];
      endings.splice(idx, 1);
      this.project.updateStoryMeta({ endings });
      row.parentElement.querySelectorAll(".ending-row")[idx]?.remove();
      // 觸發整個重繪（因為 index 會變）
      const panel = row.closest('[data-panel="endings"]');
      if (panel) this.#renderEndingsPanel(panel);
    });
    row.appendChild(header);

    row.appendChild(this.#field("ID", this.#input({
      value: ending.id || "",
      placeholder: "ending_id",
      onChange: (v) => {
        const endings = [...(this.project.storyMeta.endings || [])];
        endings[idx] = { ...endings[idx], id: v };
        this.project.updateStoryMeta({ endings });
      }
    })));

    row.appendChild(this.#field("標題", this.#input({
      value: ending.title || "",
      placeholder: "結局標題",
      onChange: (v) => {
        const endings = [...(this.project.storyMeta.endings || [])];
        endings[idx] = { ...endings[idx], title: v };
        this.project.updateStoryMeta({ endings });
      }
    })));

    const descInput = document.createElement("textarea");
    descInput.value = ending.description || "";
    descInput.placeholder = "結局描述（顯示在圖鑑中）";
    descInput.rows = 2;
    descInput.addEventListener("change", () => {
      const endings = [...(this.project.storyMeta.endings || [])];
      endings[idx] = { ...endings[idx], description: descInput.value };
      this.project.updateStoryMeta({ endings });
    });
    row.appendChild(this.#field("描述", descInput));

    return row;
  }

  // ==================== 工具方法 ====================

  #field(labelText, inputEl) {
    const wrap = document.createElement("div");
    wrap.className = "sm-field";
    const lab = document.createElement("label");
    lab.textContent = labelText;
    wrap.appendChild(lab);
    wrap.appendChild(inputEl);
    return wrap;
  }

  #labelText(text) {
    const span = document.createElement("span");
    span.className = "sm-sub-label";
    span.textContent = text;
    return span;
  }

  #input({ value, placeholder = "", onChange, readonly = false, help }) {
    const wrapper = document.createElement("span");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.flex = "1";

    const input = document.createElement("input");
    input.type = "text";
    input.value = value ?? "";
    input.placeholder = placeholder;
    if (readonly) { input.readOnly = true; input.style.opacity = "0.6"; }
    if (onChange) input.addEventListener("change", () => onChange(input.value));
    wrapper.appendChild(input);

    if (help) {
      const h = document.createElement("span");
      h.style.fontSize = "11px";
      h.style.color = "var(--e-text-faded)";
      h.style.marginTop = "2px";
      h.textContent = help;
      wrapper.appendChild(h);
    }
    return wrapper;
  }

  #datalistInput({ value, options, placeholder, onChange }) {
    const wrapper = document.createElement("span");
    wrapper.style.display = "contents";
    const input = document.createElement("input");
    input.value = value || "";
    input.placeholder = placeholder;
    const dl = document.createElement("datalist");
    const dlId = `dl-${Math.random().toString(36).slice(2, 9)}`;
    dl.id = dlId;
    input.setAttribute("list", dlId);
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      dl.appendChild(o);
    }
    if (onChange) input.addEventListener("change", () => onChange(input.value));
    wrapper.appendChild(input);
    wrapper.appendChild(dl);
    return wrapper;
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
