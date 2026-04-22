// ============================================
// InstructionRow.js
// 單一指令的卡片 UI
// ============================================

export class InstructionRow {
  /**
   * @param {Object} params
   * @param {Object} params.instruction - 指令資料
   * @param {number} params.index - 在 instructions 陣列中的 index
   * @param {number} params.indent - 條件巢狀縮排層級
   * @param {Object} params.project - StoryProject 實例
   * @param {string} params.sceneId
   * @param {Function} params.onChange - (patch) => void
   * @param {Function} params.onDelete
   */
  constructor({ instruction, index, indent, project, sceneId, onChange, onDelete }) {
    this.ins = instruction;
    this.index = index;
    this.indent = indent;
    this.project = project;
    this.sceneId = sceneId;
    this.onChange = onChange;
    this.onDelete = onDelete;
    this.el = null;
  }

  render() {
    const row = document.createElement("div");
    row.className = "instr-row";
    if (this.indent > 0) row.classList.add(`indented-${Math.min(this.indent, 3)}`);
    row.dataset.type = this.ins.type;
    if (this.ins.type === "text" && !this.ins.speaker) row.dataset.narration = "true";
    row.dataset.index = this.index;

    row.innerHTML = `
      <div class="instr-handle" title="拖曳排序"></div>
      <div class="instr-content"></div>
      <div class="instr-actions">
        <button class="btn-delete" title="刪除">×</button>
      </div>
    `;

    const content = row.querySelector(".instr-content");
    this.#renderContent(content);

    row.querySelector(".btn-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onDelete();
    });

    this.el = row;
    return row;
  }

  #renderContent(container) {
    switch (this.ins.type) {
      case "text": return this.#renderText(container);
      case "directive": return this.#renderDirective(container);
      case "set": return this.#renderSet(container);
      case "goto": return this.#renderGoto(container);
      case "ending": return this.#renderEnding(container);
      case "if":
      case "elif": return this.#renderIfElif(container);
      case "else": return this.#renderElse(container);
      case "endif": return this.#renderEndif(container);
      case "label": return this.#renderLabel(container);
      case "choice": return this.#renderChoice(container);
      default: return this.#renderUnknown(container);
    }
  }

  // ---------- 文字/對話 ----------
  #renderText(container) {
    const badge = this.#badge(this.ins.speaker ? "對話" : "旁白");
    container.appendChild(badge);

    const charNames = Object.keys(this.project.storyMeta?.characters || {});
    const speakerWrapper = document.createElement("div");
    speakerWrapper.style.display = "flex";
    speakerWrapper.style.gap = "4px";

    const speakerInput = document.createElement("input");
    speakerInput.className = "instr-field speaker";
    speakerInput.value = this.ins.speaker || "";
    speakerInput.placeholder = "（旁白）";
    speakerInput.setAttribute("list", `speakers-datalist-${this.index}`);

    const datalist = document.createElement("datalist");
    datalist.id = `speakers-datalist-${this.index}`;
    for (const name of charNames) {
      const opt = document.createElement("option");
      opt.value = name;
      datalist.appendChild(opt);
      // 也提供「主角」「主角(心聲)」等便利選項
    }
    // 額外常見角色
    for (const extra of ["主角", "主角(心聲)", "旁白"]) {
      if (!charNames.includes(extra)) {
        const opt = document.createElement("option");
        opt.value = extra;
        datalist.appendChild(opt);
      }
    }

    speakerInput.addEventListener("change", () => {
      this.onChange({ speaker: speakerInput.value });
    });
    speakerWrapper.appendChild(speakerInput);
    speakerWrapper.appendChild(datalist);
    container.appendChild(speakerWrapper);

    const textInput = document.createElement("input");
    textInput.className = "instr-field text";
    textInput.value = this.ins.text || "";
    textInput.placeholder = "輸入文字...";
    textInput.addEventListener("change", () => {
      this.onChange({ text: textInput.value });
    });
    container.appendChild(textInput);
  }

  // ---------- 畫面指令 ----------
  #renderDirective(container) {
    const name = this.ins.name;
    const nameLabel = {
      bg: "切換背景",
      show: "顯示立繪",
      hide: "隱藏立繪",
      move: "移動立繪",
      bgm: "播放 BGM",
      "bgm-stop": "停止 BGM",
      stopbgm: "停止 BGM",
      se: "音效",
      wait: "等待",
    }[name] || name;

    container.appendChild(this.#badge(nameLabel));

    const args = this.ins.args || {};
    const pos = args.positional || [];

    switch (name) {
      case "bg": {
        const files = this.project.resources.backgrounds;
        const input = this.#selectOrInput(pos[0], files, "背景檔名");
        input.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [e.target.value, ...pos.slice(1)] } });
        });
        container.appendChild(input);
        const fadeInput = this.#numberInput(args.fade, "fade (ms)");
        fadeInput.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, fade: parseInt(e.target.value) || undefined } });
        });
        container.appendChild(this.#labelInline("fade"));
        container.appendChild(fadeInput);
        break;
      }
      case "show": {
        const charNames = Object.keys(this.project.storyMeta?.characters || {});
        const charInput = this.#selectOrInput(pos[0], charNames, "角色名");
        charInput.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [e.target.value, pos[1] || "center", pos[2] || ""] } });
        });
        container.appendChild(charInput);

        const slotSelect = document.createElement("select");
        slotSelect.className = "instr-field";
        for (const slot of ["left", "center", "right"]) {
          const o = document.createElement("option");
          o.value = slot;
          o.textContent = slot;
          if ((pos[1] || "center") === slot) o.selected = true;
          slotSelect.appendChild(o);
        }
        slotSelect.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [pos[0], e.target.value, pos[2] || ""] } });
        });
        container.appendChild(slotSelect);

        // 表情
        const charName = pos[0];
        const charData = this.project.storyMeta?.characters?.[charName];
        const emotions = charData?.emotions ? Object.keys(charData.emotions) : [];
        const emoInput = this.#selectOrInput(pos[2], emotions, "表情");
        emoInput.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [pos[0], pos[1] || "center", e.target.value] } });
        });
        container.appendChild(emoInput);
        break;
      }
      case "hide": {
        const charNames = ["all", ...Object.keys(this.project.storyMeta?.characters || {})];
        const input = this.#selectOrInput(pos[0], charNames, "角色名或 all");
        input.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [e.target.value] } });
        });
        container.appendChild(input);
        break;
      }
      case "bgm": {
        const files = this.project.resources.bgm;
        const input = this.#selectOrInput(pos[0], files, "BGM 檔名");
        input.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [e.target.value] } });
        });
        container.appendChild(input);
        break;
      }
      case "se": {
        const files = this.project.resources.se;
        const input = this.#selectOrInput(pos[0], files, "音效檔名");
        input.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [e.target.value] } });
        });
        container.appendChild(input);
        break;
      }
      case "wait": {
        const input = this.#numberInput(pos[0], "毫秒");
        input.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [parseInt(e.target.value) || 500] } });
        });
        container.appendChild(input);
        break;
      }
      case "move": {
        const charNames = Object.keys(this.project.storyMeta?.characters || {});
        const input = this.#selectOrInput(pos[0], charNames, "角色名");
        input.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [e.target.value, pos[1]] } });
        });
        container.appendChild(input);
        const movInput = document.createElement("input");
        movInput.className = "instr-field";
        movInput.value = pos[1] || "";
        movInput.placeholder = "left→right";
        movInput.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [pos[0], e.target.value] } });
        });
        container.appendChild(movInput);
        break;
      }
      default: {
        // 未知指令，顯示為唯讀文字
        const readonly = document.createElement("span");
        readonly.className = "instr-readonly";
        readonly.textContent = `@${name} ${pos.join(" ")}`;
        container.appendChild(readonly);
      }
    }
  }

  // ---------- Set ----------
  #renderSet(container) {
    container.appendChild(this.#badge("設定"));

    const keyInput = document.createElement("input");
    keyInput.className = "instr-field";
    keyInput.value = this.ins.key || "";
    keyInput.placeholder = "flag 名稱";
    keyInput.style.minWidth = "120px";
    keyInput.style.fontFamily = "var(--e-font-mono)";
    keyInput.addEventListener("change", () => this.onChange({ key: keyInput.value }));
    container.appendChild(keyInput);

    const opSelect = document.createElement("select");
    opSelect.className = "instr-field";
    opSelect.style.minWidth = "50px";
    for (const op of ["=", "+=", "-="]) {
      const o = document.createElement("option");
      o.value = op;
      o.textContent = op;
      if (this.ins.op === op) o.selected = true;
      opSelect.appendChild(o);
    }
    opSelect.addEventListener("change", () => this.onChange({ op: opSelect.value }));
    container.appendChild(opSelect);

    const valInput = document.createElement("input");
    valInput.className = "instr-field";
    valInput.style.minWidth = "120px";
    valInput.style.fontFamily = "var(--e-font-mono)";
    valInput.value = String(this.ins.value);
    valInput.placeholder = "true / 1 / \"hello\"";
    valInput.addEventListener("change", () => {
      this.onChange({ value: this.#parseValue(valInput.value) });
    });
    container.appendChild(valInput);
  }

  #parseValue(s) {
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null") return null;
    if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
    if (/^[+-]?\d+\.\d+$/.test(s)) return parseFloat(s);
    return s.replace(/^["']|["']$/g, "");
  }

  // ---------- Goto ----------
  #renderGoto(container) {
    container.appendChild(this.#badge("跳轉"));

    const targets = [
      ...this.project.getAllSceneIds(),
      ...this.#getLabelsInCurrentScene(),
    ];
    const input = this.#selectOrInput(this.ins.target, targets, "場景 ID 或標籤");
    input.addEventListener("change", (e) => this.onChange({ target: e.target.value }));
    container.appendChild(input);
  }

  #getLabelsInCurrentScene() {
    const sc = this.project.getScene(this.sceneId);
    if (!sc) return [];
    return sc.instructions
      .filter(x => x.type === "label")
      .map(x => x.name);
  }

  // ---------- Ending ----------
  #renderEnding(container) {
    container.appendChild(this.#badge("結局"));

    const idInput = document.createElement("input");
    idInput.className = "instr-field";
    idInput.style.minWidth = "140px";
    idInput.style.fontFamily = "var(--e-font-mono)";
    idInput.value = this.ins.id || "";
    idInput.placeholder = "ending_id";
    idInput.addEventListener("change", () => this.onChange({ id: idInput.value }));
    container.appendChild(this.#labelInline("id"));
    container.appendChild(idInput);

    const titleInput = document.createElement("input");
    titleInput.className = "instr-field";
    titleInput.style.minWidth = "140px";
    titleInput.value = this.ins.title || "";
    titleInput.placeholder = "結局標題";
    titleInput.addEventListener("change", () => this.onChange({ title: titleInput.value }));
    container.appendChild(this.#labelInline("title"));
    container.appendChild(titleInput);

    const descInput = document.createElement("input");
    descInput.className = "instr-field";
    descInput.style.flex = "1";
    descInput.style.minWidth = "200px";
    descInput.value = this.ins.desc || "";
    descInput.placeholder = "描述（圖鑑顯示）";
    descInput.addEventListener("change", () => this.onChange({ desc: descInput.value }));
    container.appendChild(this.#labelInline("desc"));
    container.appendChild(descInput);
  }

  // ---------- If/Elif ----------
  #renderIfElif(container) {
    container.appendChild(this.#badge(this.ins.type === "if" ? "IF" : "ELIF"));

    const condInput = document.createElement("input");
    condInput.className = "instr-field condition";
    condInput.value = this.ins.condition || "";
    condInput.placeholder = "條件表達式，例: met_alice && charm > 2";
    condInput.addEventListener("change", () => this.onChange({ condition: condInput.value }));
    container.appendChild(condInput);
  }

  // ---------- Else ----------
  #renderElse(container) {
    container.appendChild(this.#badge("ELSE"));
    const readonly = document.createElement("span");
    readonly.className = "instr-readonly";
    readonly.textContent = "否則";
    container.appendChild(readonly);
  }

  // ---------- Endif ----------
  #renderEndif(container) {
    container.appendChild(this.#badge("ENDIF"));
    const readonly = document.createElement("span");
    readonly.className = "instr-readonly";
    readonly.textContent = "條件結束";
    container.appendChild(readonly);
  }

  // ---------- Label ----------
  #renderLabel(container) {
    container.appendChild(this.#badge("標籤"));
    const input = document.createElement("input");
    input.className = "instr-field label";
    input.value = this.ins.name || "";
    input.placeholder = "label_name";
    input.addEventListener("change", () => this.onChange({ name: input.value }));
    container.appendChild(input);
  }

  // ---------- Choice ----------
  #renderChoice(container) {
    const header = document.createElement("div");
    header.className = "choice-header";
    header.appendChild(this.#badge("選項"));
    const label = document.createElement("span");
    label.className = "instr-readonly";
    label.textContent = `${this.ins.options.length} 個選項`;
    header.appendChild(label);
    container.appendChild(header);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "choice-options";

    const options = this.ins.options || [];
    options.forEach((opt, idx) => {
      const optEl = this.#renderChoiceOption(opt, idx);
      optionsWrap.appendChild(optEl);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "choice-add-option";
    addBtn.textContent = "+ 新增選項";
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newOpts = [...options, { text: "", set: {}, goto: "" }];
      this.onChange({ options: newOpts });
    });
    optionsWrap.appendChild(addBtn);

    container.appendChild(optionsWrap);
  }

  #renderChoiceOption(opt, idx) {
    const el = document.createElement("div");
    el.className = "choice-option";

    const main = document.createElement("div");
    main.className = "choice-option-main";

    const textInput = document.createElement("input");
    textInput.className = "instr-field choice-option-text";
    textInput.value = opt.text || "";
    textInput.placeholder = "選項文字";
    textInput.addEventListener("change", () => {
      const options = [...this.ins.options];
      options[idx] = { ...options[idx], text: textInput.value };
      this.onChange({ options });
    });
    main.appendChild(textInput);

    const meta = document.createElement("div");
    meta.className = "choice-option-meta";

    // Set 預覽與編輯
    const setLabel = document.createElement("label");
    setLabel.textContent = "set:";
    meta.appendChild(setLabel);
    const setInput = document.createElement("input");
    setInput.className = "instr-field";
    setInput.style.minWidth = "140px";
    setInput.value = this.#formatSet(opt.set || {});
    setInput.placeholder = "flag: true, x: 1";
    setInput.addEventListener("change", () => {
      const options = [...this.ins.options];
      options[idx] = { ...options[idx], set: this.#parseSet(setInput.value) };
      this.onChange({ options });
    });
    meta.appendChild(setInput);

    // Goto
    const gotoLabel = document.createElement("label");
    gotoLabel.textContent = "goto:";
    meta.appendChild(gotoLabel);
    const gotoTargets = [
      ...this.project.getAllSceneIds(),
      ...this.#getLabelsInCurrentScene(),
    ];
    const gotoInput = this.#selectOrInput(opt.goto, gotoTargets, "目標");
    gotoInput.style.minWidth = "140px";
    gotoInput.addEventListener("change", (e) => {
      const options = [...this.ins.options];
      options[idx] = { ...options[idx], goto: e.target.value };
      this.onChange({ options });
    });
    meta.appendChild(gotoInput);

    main.appendChild(meta);
    el.appendChild(main);

    const delBtn = document.createElement("button");
    delBtn.className = "choice-option-delete";
    delBtn.textContent = "×";
    delBtn.title = "刪除選項";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const options = this.ins.options.filter((_, i) => i !== idx);
      this.onChange({ options });
    });
    el.appendChild(delBtn);

    return el;
  }

  #formatSet(obj) {
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : v}`)
      .join(", ");
  }

  #parseSet(str) {
    const result = {};
    if (!str.trim()) return result;
    const parts = str.split(",");
    for (const part of parts) {
      const m = part.match(/^\s*([a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*)\s*:\s*(.+)\s*$/);
      if (m) result[m[1]] = this.#parseValue(m[2].trim());
    }
    return result;
  }

  // ---------- 工具方法 ----------
  #badge(text) {
    const span = document.createElement("span");
    span.className = "instr-type-badge";
    span.textContent = text;
    return span;
  }

  #labelInline(text) {
    const span = document.createElement("span");
    span.style.color = "var(--e-text-faded)";
    span.style.fontSize = "11px";
    span.style.fontFamily = "var(--e-font-mono)";
    span.textContent = text;
    return span;
  }

  #numberInput(value, placeholder) {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "instr-field";
    input.style.width = "100px";
    input.value = value ?? "";
    input.placeholder = placeholder;
    return input;
  }

  #selectOrInput(currentValue, options, placeholder) {
    // 如果有選項清單，用 datalist 自動補完
    const wrapper = document.createElement("span");
    wrapper.style.display = "contents";

    const input = document.createElement("input");
    input.className = "instr-field";
    input.value = currentValue || "";
    input.placeholder = placeholder;

    if (options && options.length > 0) {
      const datalist = document.createElement("datalist");
      const id = `dl-${Math.random().toString(36).slice(2, 9)}`;
      datalist.id = id;
      for (const opt of options) {
        const o = document.createElement("option");
        o.value = opt;
        datalist.appendChild(o);
      }
      input.setAttribute("list", id);
      wrapper.appendChild(datalist);
    }
    wrapper.appendChild(input);
    return input;
  }

  #renderUnknown(container) {
    const badge = this.#badge("未知");
    container.appendChild(badge);
    const text = document.createElement("span");
    text.className = "instr-readonly";
    text.textContent = JSON.stringify(this.ins);
    container.appendChild(text);
  }
}
