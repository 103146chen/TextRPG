// ============================================
// InstructionRow.js
// 單一指令的卡片 UI
// ============================================

import { createSelectField } from "./selectField.js";
import { renderDirectiveForm, DIRECTIVE_SCHEMAS } from "./directiveFields.js";
import { speakerColor } from "../core/speakerColor.js";
import { escapeHtml } from "./formFields.js";

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
  constructor({ instruction, index, indent, project, sceneId, onChange, onDelete, onPlayFrom, onManage, selected = false, onSelect = null }) {
    this.ins = instruction;
    this.index = index;
    this.indent = indent;
    this.project = project;
    this.sceneId = sceneId;
    this.onChange = onChange;
    this.onDelete = onDelete;
    this.onPlayFrom = onPlayFrom;   // 可選：(index) => void，「從這裡試玩」
    this.onManage = onManage;       // 可選：(tab) => void，跳到對應的管理分頁
    this.selected = selected;
    this.onSelect = onSelect;       // 可選：() => void，點列選取（靜態預覽跟隨）
    this.el = null;
  }

  render() {
    const row = document.createElement("div");
    row.className = "instr-row";
    if (this.indent > 0) row.classList.add(`indented-${Math.min(this.indent, 3)}`);
    row.dataset.type = this.ins.type;
    if (this.ins.type === "text" && !this.ins.speaker) row.dataset.narration = "true";
    if (this.ins.type === "directive") row.dataset.name = this.ins.name;
    row.dataset.index = this.index;
    if (this.selected) row.classList.add("selected");
    if (this.onSelect) {
      row.addEventListener("click", () => this.onSelect());
    }

    row.innerHTML = `
      <div class="instr-num">${this.index + 1}</div>
      <div class="instr-handle" title="拖曳排序"></div>
      <div class="instr-content"></div>
      <div class="instr-actions">
        <button class="btn-play" title="從這裡試玩" style="cursor:pointer">▶</button>
        <button class="btn-delete" title="刪除">×</button>
      </div>
    `;

    const content = row.querySelector(".instr-content");
    this.#renderContent(content);

    row.querySelector(".btn-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onDelete();
    });

    const playBtn = row.querySelector(".btn-play");
    if (this.onPlayFrom) {
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onPlayFrom(this.index);
      });
    } else {
      playBtn.remove();
    }

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
      case "comment": return this.#renderComment(container);
      default: return this.#renderUnknown(container);
    }
  }

  // ---------- 文字/對話 ----------
  // 版型：上排＝說話者（色塊 + 名字），下排＝對話文字（整列寬、自動換行）
  #renderText(container) {
    container.classList.add("is-dialogue");

    const speaker = this.ins.speaker || "";
    const charNames = Object.keys(this.project.storyMeta?.characters || {});

    // ---- 上排：說話者 ----
    const head = document.createElement("div");
    head.className = "dlg-head";

    const avatar = document.createElement("span");
    avatar.className = "dlg-avatar" + (speaker ? "" : " narration");
    avatar.textContent = speaker ? speaker.slice(0, 1) : "旁";
    avatar.style.background = speaker ? speakerColor(this.project, speaker) : "";
    head.appendChild(avatar);

    const speakerInput = document.createElement("input");
    speakerInput.className = "instr-field dlg-speaker";
    speakerInput.value = speaker;
    speakerInput.placeholder = "（旁白）";
    speakerInput.setAttribute("list", `speakers-datalist-${this.index}`);
    if (speaker) speakerInput.style.color = speakerColor(this.project, speaker);

    const datalist = document.createElement("datalist");
    datalist.id = `speakers-datalist-${this.index}`;
    for (const name of charNames) {
      const opt = document.createElement("option");
      opt.value = name;
      datalist.appendChild(opt);
    }
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
    head.append(speakerInput, datalist);

    // 當句表情：只在「說話者是已定義且有表情差分的角色」時出現，
    // 讓演出中途換表情不必另外插一條 @show。
    const charData = this.project.storyMeta?.characters?.[speaker];
    const emotions = charData?.emotions ? Object.keys(charData.emotions) : [];
    if (speaker && charData && emotions.length) {
      const emoField = createSelectField({
        value: this.ins.emotion || "",
        options: emotions,
        placeholder: "（表情不變）",
        addLabel: "編輯角色表情…",
        onAdd: () => this.onManage?.("characters"),
        onChange: (v) => this.onChange({ emotion: v || undefined }),
      });
      emoField.classList.add("dlg-emotion");
      emoField.title = "這句話播出時，把該角色的立繪切成此表情";
      head.appendChild(emoField);
    }
    container.appendChild(head);

    // ---- 下排：文字（textarea 自動長高、自動換行）----
    const textInput = document.createElement("textarea");
    textInput.className = "instr-field dlg-text";
    textInput.rows = 1;
    textInput.value = this.ins.text || "";
    textInput.placeholder = "輸入文字...";
    const autoGrow = () => {
      textInput.style.height = "auto";
      textInput.style.height = `${textInput.scrollHeight}px`;
    };
    textInput.addEventListener("input", autoGrow);
    textInput.addEventListener("change", () => {
      this.onChange({ text: textInput.value });
    });
    // Enter 送出（維持單行語意）；Shift+Enter 才換行
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); textInput.blur(); }
    });
    container.appendChild(textInput);
    // 初次依內容長高：要等接上版面才量得到。rAF 在背景／隱藏分頁會被節流而
    // 不觸發，因此另掛 setTimeout 保底，並在取得焦點時再校正一次。
    requestAnimationFrame(autoGrow);
    setTimeout(autoGrow, 0);
    textInput.addEventListener("focus", autoGrow);
  }

  // ---------- 註解（作者筆記，執行時無作用）----------
  #renderComment(container) {
    const hash = document.createElement("span");
    hash.className = "comment-hash";
    hash.textContent = "#";
    container.appendChild(hash);

    const input = document.createElement("input");
    input.className = "instr-field comment";
    input.value = this.ins.text || "";
    input.placeholder = "備註（不會出現在遊戲中）";
    input.addEventListener("change", () => this.onChange({ text: input.value }));
    container.appendChild(input);
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
      voice: "語音",
      wait: "等待",
      shake: "震動螢幕",
      flash: "閃光",
      tint: "畫面染色",
      "tint-clear": "清除染色",
      curtain: "帷幕",
      ui: "界面顯示",
      textcfg: "文本參數",
      camera: "鏡頭",
      "camera-reset": "復位鏡頭",
      sprite: "精靈動畫",
      float: "浮動文字",
      "se-stop": "停止音效",
      stopse: "停止音效",
      clear: "銷毀場景",
      auto: "自動播放",
      video: "播放視頻",
      "video-stop": "停止視頻",
      stopvideo: "停止視頻",
      particles: "粒子效果",
      "particles-stop": "停止粒子",
      stopparticles: "停止粒子",
    }[name] || name;

    const ICONS = {
      bg: "🖼", show: "🧍", hide: "🫥", move: "↔",
      bgm: "🎵", "bgm-stop": "🔇", stopbgm: "🔇",
      se: "🔔", "se-stop": "🔇", stopse: "🔇", voice: "🎙",
      wait: "⏱", auto: "▶", textcfg: "✎",
      shake: "💥", flash: "⚡", tint: "🎨", "tint-clear": "🧼",
      curtain: "🎭", ui: "🪟",
      camera: "🎥", "camera-reset": "🎥",
      sprite: "✨", float: "💬",
      video: "🎬", "video-stop": "⏹", stopvideo: "⏹",
      particles: "❄", "particles-stop": "⏹", stopparticles: "⏹",
      clear: "🗑",
    };
    container.appendChild(this.#badge(`${ICONS[name] ?? "＠"} ${nameLabel}`));

    const args = this.ins.args || {};
    const pos = args.positional || [];

    // schema 驅動的指令：卡片與檢查器共用同一份欄位定義（compact 版型）
    if (DIRECTIVE_SCHEMAS[name]) {
      renderDirectiveForm(container, this.ins, DIRECTIVE_SCHEMAS[name],
        (newArgs) => this.onChange({ args: newArgs }),
        { compact: true, context: { project: this.project, onManage: this.onManage } });
      return;
    }

    switch (name) {
      case "wait": {
        const input = this.#numberInput(pos[0], "毫秒");
        input.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [parseInt(e.target.value) || 500] } });
        });
        container.appendChild(input);

        // 快速值（常用停頓長度一鍵設定）
        const presets = document.createElement("span");
        presets.className = "wait-presets";
        const cur = parseInt(pos[0], 10);
        for (const ms of [200, 500, 1000, 2000, 3000]) {
          const b = document.createElement("button");
          b.className = "wait-preset" + (cur === ms ? " active" : "");
          b.textContent = String(ms);
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            this.onChange({ args: { ...args, positional: [ms] } });
            // instruction-updated 不觸發整列重繪（保住輸入焦點），自己同步 UI
            presets.querySelectorAll(".wait-preset").forEach((x) => x.classList.toggle("active", x === b));
            input.value = String(ms);
            approx.textContent = `≈ ${ms / 1000} 秒`;
          });
          presets.appendChild(b);
        }
        container.appendChild(presets);

        const approx = document.createElement("span");
        approx.className = "instr-label-inline wait-approx";
        approx.textContent = `≈ ${(cur / 1000) || 0.5} 秒`;
        container.appendChild(approx);
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
      case "ui": {
        const modeSel = document.createElement("select");
        modeSel.className = "instr-field";
        for (const [val, txt] of [["hide", "隱藏界面"], ["show", "顯示界面"]]) {
          const o = document.createElement("option");
          o.value = val; o.textContent = txt;
          if ((pos[0] || "hide") === val) o.selected = true;
          modeSel.appendChild(o);
        }
        modeSel.addEventListener("change", () => {
          this.onChange({ args: { ...args, positional: [modeSel.value] } });
        });
        container.appendChild(modeSel);
        container.appendChild(this.#labelInline("隱藏後點擊畫面會先恢復界面"));
        break;
      }
      case "float": {
        const tInput = document.createElement("input");
        tInput.className = "instr-field";
        tInput.style.minWidth = "140px";
        tInput.value = pos.join(" ");
        tInput.placeholder = "浮動文字內容";
        tInput.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, positional: [e.target.value] } });
        });
        container.appendChild(tInput);

        const numField = (key, label, ph) => {
          container.appendChild(this.#labelInline(label));
          const input = this.#numberInput(args[key], ph);
          input.addEventListener("change", (e) => {
            const v = e.target.value.trim();
            this.onChange({ args: { ...args, [key]: v === "" ? undefined : parseFloat(v) } });
          });
          container.appendChild(input);
        };
        numField("x", "X%", "50");
        numField("y", "Y%", "40");
        numField("duration", "時長", "ms");
        break;
      }
      case "se-stop":
      case "stopse": {
        container.appendChild(this.#labelInline("停止所有播放中的音效"));
        break;
      }
      case "clear": {
        container.appendChild(this.#labelInline("清空立繪/背景/特效/鏡頭"));
        container.appendChild(this.#labelInline("fade"));
        const fInput = this.#numberInput(args.fade, "ms");
        fInput.addEventListener("change", (e) => {
          this.onChange({ args: { ...args, fade: parseInt(e.target.value) || undefined } });
        });
        container.appendChild(fInput);
        break;
      }
      case "auto": {
        const modeSel = document.createElement("select");
        modeSel.className = "instr-field";
        for (const [val, txt] of [["on", "進入自動播放"], ["off", "退出自動播放"]]) {
          const o = document.createElement("option");
          o.value = val; o.textContent = txt;
          if ((pos[0] || "on") === val) o.selected = true;
          modeSel.appendChild(o);
        }
        modeSel.addEventListener("change", () => {
          this.onChange({ args: { ...args, positional: [modeSel.value] } });
        });
        container.appendChild(modeSel);
        container.appendChild(this.#labelInline("間隔"));
        const dInput = this.#numberInput(args.delay, "ms");
        dInput.addEventListener("change", (e) => {
          const v = e.target.value.trim();
          this.onChange({ args: { ...args, delay: v === "" ? undefined : parseInt(v) } });
        });
        container.appendChild(dInput);
        break;
      }
      case "video": {
        const files = this.project.resources.video || [];
        const input = createSelectField({
          value: pos[0], options: files, placeholder: "選視頻檔",
          addLabel: "匯入視頻…", onAdd: () => this.onManage?.("asset-video"),
          onChange: (v) => this.onChange({ args: { ...args, positional: [v] } }),
        });
        container.appendChild(input);

        const loopLabel = document.createElement("label");
        loopLabel.className = "instr-inline-label";
        const loopCb = document.createElement("input");
        loopCb.type = "checkbox";
        loopCb.checked = args.loop === true || args.loop === "true";
        loopCb.addEventListener("change", () => {
          this.onChange({ args: { ...args, loop: loopCb.checked ? true : undefined } });
        });
        loopLabel.appendChild(loopCb);
        loopLabel.appendChild(document.createTextNode(" 循環"));
        container.appendChild(loopLabel);
        container.appendChild(this.#labelInline("無循環＝播完才繼續"));
        break;
      }
      case "video-stop":
      case "stopvideo": {
        container.appendChild(this.#labelInline("停止並移除視頻層"));
        break;
      }
      case "particles-stop":
      case "stopparticles": {
        container.appendChild(this.#labelInline("停止粒子效果"));
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
    container.appendChild(this.#badge("⚑ 設定"));

    const keyInput = createSelectField({
      value: this.ins.key || "",
      options: this.project.getKnownFlagNames(),
      placeholder: "選旗標",
      addLabel: "新增旗標…", onAdd: () => this.onManage?.("flags"),
      onChange: (v) => this.onChange({ key: v }),
    });
    keyInput.style.minWidth = "120px";
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

  // 與 SceneParser 一致：`+= 1` / `-= 2` -> { op, value }，其餘照一般值
  #parseOpValue(raw) {
    const opMatch = raw.match(/^(\+=|-=)\s*(.+)$/);
    if (opMatch) {
      const num = this.#parseValue(opMatch[2].trim());
      if (typeof num === "number") return { op: opMatch[1], value: num };
    }
    return this.#parseValue(raw);
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
  // 結局：內容以敘事地圖的結局註冊表為唯一真相，這裡只選 id + 唯讀預覽，
  // 要改文字就跳到敘事地圖編輯（避免兩邊各改一份而分歧）。
  #renderEnding(container) {
    container.classList.add("is-ending");
    container.appendChild(this.#badge("結局"));

    const registry = this.project.storyMeta?.endings || [];
    const id = this.ins.id || "";
    const reg = registry.find((e) => e.id === id);

    const head = document.createElement("div");
    head.className = "ending-card-head";

    const idField = createSelectField({
      value: id,
      options: registry.map((e) => e.id).filter(Boolean),
      placeholder: "選擇結局…",
      addLabel: "到敘事地圖新增…",
      onAdd: () => this.onManage?.("endings"),
      onChange: (v) => this.onChange({ id: v }),
    });
    idField.style.minWidth = "180px";
    head.appendChild(this.#labelInline("id"));
    head.appendChild(idField);

    const editBtn = document.createElement("button");
    editBtn.className = "tb-btn ending-card-edit";
    editBtn.textContent = "到敘事地圖編輯";
    editBtn.title = "結局的標題與描述統一在敘事地圖維護";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onManage?.(id ? `ending:${id}` : "endings");
    });
    head.appendChild(editBtn);
    container.appendChild(head);

    const body = document.createElement("div");
    body.className = "ending-card-body";
    if (!id) {
      body.innerHTML = `<span class="ending-card-warn">尚未選擇結局。</span>`;
    } else if (!reg) {
      body.innerHTML =
        `<span class="ending-card-warn">「${escapeHtml(id)}」尚未登記於結局清單，` +
        `遊戲會退回使用這條指令自帶的文字。建議到敘事地圖登記。</span>`;
    } else {
      body.innerHTML =
        `<div class="ending-card-title">${escapeHtml(reg.title || id)}</div>` +
        `<div class="ending-card-desc">${escapeHtml(reg.description || "（尚無描述）")}</div>`;
    }
    container.appendChild(body);
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

    // 運算式無法純下拉，提供「插入旗標」輔助（含跳新增）
    const insertSel = document.createElement("select");
    insertSel.className = "instr-field";
    insertSel.title = "插入旗標名到條件式";
    insertSel.style.maxWidth = "110px";
    const ph = document.createElement("option");
    ph.value = ""; ph.textContent = "＋旗標";
    insertSel.appendChild(ph);
    for (const f of this.project.getKnownFlagNames()) {
      const o = document.createElement("option");
      o.value = f; o.textContent = f;
      insertSel.appendChild(o);
    }
    const addOpt = document.createElement("option");
    addOpt.value = "\u0000add"; addOpt.textContent = "＋ 新增旗標…";
    insertSel.appendChild(addOpt);
    insertSel.addEventListener("change", () => {
      const v = insertSel.value;
      insertSel.value = "";
      if (v === "\u0000add") { this.onManage?.("flags"); return; }
      if (!v) return;
      const cur = condInput.value.trim();
      condInput.value = cur ? `${cur} ${v}` : v;
      this.onChange({ condition: condInput.value });
    });
    container.appendChild(insertSel);
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
      .map(([k, v]) => {
        if (v && typeof v === "object" && "op" in v) return `${k}: ${v.op} ${v.value}`;
        return `${k}: ${typeof v === "string" ? `"${v}"` : v}`;
      })
      .join(", ");
  }

  #parseSet(str) {
    const result = {};
    if (!str.trim()) return result;
    const parts = str.split(",");
    for (const part of parts) {
      const m = part.match(/^\s*([a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*)\s*:\s*(.+)\s*$/);
      if (m) result[m[1]] = this.#parseOpValue(m[2].trim());
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
