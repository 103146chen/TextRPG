// ============================================
// InstructionRow.js
// 單一指令的卡片 UI
// ============================================

import { createSelectField } from "./selectField.js";
import { renderDirectiveForm, DIRECTIVE_SCHEMAS } from "./directiveFields.js";
import { speakerColor } from "../core/speakerColor.js";
import { assetUrl } from "../core/assetUrl.js";
import { escapeHtml } from "./formFields.js";
import { renderConditionBuilder, explainCondition } from "./conditionBuilder.js";

export class InstructionRow {
  // 選項晶片展開哪一格（純 UI 狀態，不進資料）。見 #renderChoiceChips 的說明。
  static _openPanel = new Map();

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
  constructor({ instruction, index, indent, project, sceneId, onChange, onDelete, onPlayFrom, onManage, selected = false, onSelect = null, onEnterContinue = null, continuation = false, onOpenBlock = null, onCreateBlock = null }) {
    this.ins = instruction;
    this.index = index;
    this.indent = indent;
    this.continuation = continuation;  // 與上一句同說話者：收起重複的說話者列
    this.project = project;
    this.sceneId = sceneId;
    this.onChange = onChange;
    this.onDelete = onDelete;
    this.onPlayFrom = onPlayFrom;   // 可選：(index) => void，「從這裡試玩」
    this.onManage = onManage;       // 可選：(tab) => void，跳到對應的管理分頁
    this.selected = selected;
    this.onSelect = onSelect;       // 可選：() => void，點列選取（靜態預覽跟隨）
    this.onEnterContinue = onEnterContinue;  // 可選：(index, speaker) => void，Enter 接下一句
    this.onOpenBlock = onOpenBlock;          // 可選：(name) => void，開啟具名區塊的分頁
    this.onCreateBlock = onCreateBlock;      // 可選：(optionIndex) => void，替選項建立內容區塊
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
      case "block": return this.#renderBlock(container);
      case "endblock": return this.#renderEndblock(container);
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

    // 說話者列在兩種情況下收起（hover／聚焦時再展開，仍然改得動）：
    //   旁白      —— 沒有說話者可顯示，那一列整條是空的
    //   連續同一人 —— 名字重複寫一次沒有意義
    // 這句自己有設表情就不收，否則表情設定會被藏住看不到。
    container.style.setProperty("--dlg-color", speaker ? speakerColor(this.project, speaker) : "#8b8b8b");
    if ((!speaker || this.continuation) && !this.ins.emotion) {
      container.classList.add("is-cont");
      // 續行線只給「同一個角色接著說」用——它的意思是「還是他在講」。
      // 旁白沒有說話者，連續旁白也不該畫線，否則看起來像在指涉某個角色。
      if (this.continuation && speaker) container.classList.add("is-cont-line");
    }

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
    // Enter：接一句同說話者的台詞（對話占劇本大宗，這是最短路徑）；
    // Shift+Enter 才是換行。沒接 onEnterContinue 時退回原本的送出行為。
    textInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      // 先把剛打的字寫回，否則插入造成重繪時這一行會遺失
      if (textInput.value !== (this.ins.text || "")) this.onChange({ text: textInput.value });
      if (this.onEnterContinue) this.onEnterContinue(this.index, this.ins.speaker || "");
      else textInput.blur();
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

      // 背景指令：整張卡片鋪上該張背景（壓暗），一眼掃過就知道換到哪個場景
      if (name === "bg" && pos[0]) {
        container.classList.add("has-bgimage");
        assetUrl(this.project, "backgrounds", pos[0]).then((url) => {
          if (url && container.isConnected) container.style.setProperty("--bg-thumb", `url("${url}")`);
        });
      }
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
      placeholder: "選變數",
      addLabel: "新增變數…", onAdd: () => this.onManage?.("flags"),
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
    container.classList.add("is-cond");
    container.appendChild(this.#badge(this.ins.type === "if" ? "IF" : "ELIF"));

    // 圖形化條件產生器（主要操作方式）；下方文字框保留為進階模式
    const builder = document.createElement("div");
    builder.className = "cond-builder-host";
    renderConditionBuilder(builder, {
      expr: this.ins.condition || "",
      flags: this.project.getKnownFlagNames(),
      onManage: () => this.onManage?.("flags"),
      onChange: (expr) => this.onChange({ condition: expr }),
    });
    container.appendChild(builder);

    const adv = document.createElement("details");
    adv.className = "cond-adv";
    const sum = document.createElement("summary");
    sum.textContent = "進階：直接編輯條件式";
    adv.appendChild(sum);

    const condInput = document.createElement("input");
    condInput.className = "instr-field condition";
    condInput.value = this.ins.condition || "";
    condInput.placeholder = "條件表達式，例: met_alice && charm > 2";
    condInput.addEventListener("change", () => this.onChange({ condition: condInput.value }));
    adv.appendChild(condInput);
    container.appendChild(adv);

    // 運算式無法純下拉，提供「插入變數」輔助（含跳新增）
    const insertSel = document.createElement("select");
    insertSel.className = "instr-field";
    insertSel.title = "插入變數名到條件式";
    insertSel.style.maxWidth = "110px";
    const ph = document.createElement("option");
    ph.value = ""; ph.textContent = "＋變數";
    insertSel.appendChild(ph);
    for (const f of this.project.getKnownFlagNames()) {
      const o = document.createElement("option");
      o.value = f; o.textContent = f;
      insertSel.appendChild(o);
    }
    const addOpt = document.createElement("option");
    addOpt.value = "\u0000add"; addOpt.textContent = "＋ 新增變數…";
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
    adv.appendChild(insertSel);   // 屬於進階模式（直接改運算式）
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

  // ---------- 具名內容區塊 ----------
  // 主線上只佔一張摘要卡；內容在它自己的分頁裡編輯。
  #renderBlock(container) {
    container.appendChild(this.#badge("↳ 內容區塊"));

    const name = document.createElement("span");
    name.className = "block-card-name";
    name.textContent = this.ins.name || "（未命名）";
    container.appendChild(name);

    const note = document.createElement("span");
    note.className = "instr-readonly";
    // 講清楚它為什麼在主線上卻不會被播到，否則看起來像 bug
    note.textContent = "只有選項指定它時才會執行，主線會跳過";
    container.appendChild(note);

    if (this.onOpenBlock) {
      const open = document.createElement("button");
      open.className = "block-open-btn";
      open.textContent = "開啟編輯 →";
      open.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onOpenBlock(this.ins.name);
      });
      container.appendChild(open);
    }
  }

  // endblock 在主線上被摘要卡蓋掉、在區塊分頁裡不顯示，
  // 只有畸形劇本（孤兒 endblock）才會走到這裡。
  #renderEndblock(container) {
    container.appendChild(this.#badge("ENDBLOCK"));
    const readonly = document.createElement("span");
    readonly.className = "instr-readonly";
    readonly.textContent = "沒有對應的區塊開頭（多餘的結束標記）";
    container.appendChild(readonly);
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

    main.appendChild(this.#renderChoiceChips(opt, idx));
    el.appendChild(main);

    // 排序（▲▼）：改順序不必再刪掉重建
    const order = document.createElement("div");
    order.className = "choice-option-order";
    const mk = (txt, dir, disabled) => {
      const b = document.createElement("button");
      b.className = "choice-order-btn";
      b.textContent = txt;
      b.title = dir < 0 ? "上移" : "下移";
      b.disabled = disabled;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const options = [...this.ins.options];
        const j = idx + dir;
        if (j < 0 || j >= options.length) return;
        [options[idx], options[j]] = [options[j], options[idx]];
        this.onChange({ options });
      });
      return b;
    };
    order.append(mk("▲", -1, idx === 0), mk("▼", +1, idx === this.ins.options.length - 1));
    el.appendChild(order);

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

  /**
   * 選項的三個設定（跳轉／變數／顯示條件）收成一列摘要晶片，點了才展開編輯。
   *
   * 原本三段編輯器一律攤開，就算什麼都沒設也各佔一列——一個選項 108px，
   * 一張三選項的卡片 441px，等於 2/3 個螢幕。收成晶片後沒設定的選項約 50px。
   *
   * 展開狀態放在模組層的 Map：這一列每次變更都整個重建，狀態放實例上會被沖掉，
   * 使用者改一個值面板就闔起來。索引位移時鍵會失效，最壞情況只是展開錯一格，
   * 對純 UI 狀態可以接受。
   */
  #renderChoiceChips(opt, idx) {
    const wrap = document.createElement("div");
    wrap.className = "choice-chips";

    const key = `${this.sceneId}#${this.index}#${idx}`;
    const openNow = InstructionRow._openPanel.get(key) || null;
    const toggle = (name) => {
      if (openNow === name) InstructionRow._openPanel.delete(key);
      else InstructionRow._openPanel.set(key, name);
      // 只重畫這個選項的晶片區，不動整列（不然輸入焦點會跑掉）
      const fresh = this.#renderChoiceChips(opt, idx);
      wrap.replaceWith(fresh);
    };

    const bar = document.createElement("div");
    bar.className = "choice-chip-bar";

    const chip = (name, label, { active = false, title = "", onClick } = {}) => {
      const b = document.createElement("button");
      b.className = "choice-chip"
        + (active ? " is-set" : "")
        + (openNow === name ? " is-open" : "");
      b.dataset.panel = name;
      b.textContent = label;
      if (title) b.title = title;
      b.addEventListener("click", (e) => { e.stopPropagation(); (onClick || (() => toggle(name)))(); });
      return b;
    };

    // 專屬內容：不是可展開的面板，是直接開分頁／建立，所以自己處理點擊
    if (opt.do) {
      bar.appendChild(chip("do", `↳ ${opt.do}`, {
        active: true, title: "開啟這個選項的內容區塊（跑完回主線）",
        onClick: () => this.onOpenBlock?.(opt.do),
      }));
    } else if (this.onCreateBlock) {
      bar.appendChild(chip("do", "＋ 專屬內容", {
        title: "建立這個選項專屬的劇情，跑完自動回到主線",
        onClick: () => this.onCreateBlock(idx),
      }));
    }

    bar.appendChild(chip("goto", opt.goto ? `→ ${opt.goto}` : "＋ 跳轉", {
      active: !!opt.goto,
      title: "跳過去就不回來了；要「跑完回主線」請用專屬內容",
    }));

    const setEntries = Object.entries(opt.set || {});
    bar.appendChild(chip("set", setEntries.length ? this.#summarizeSet(setEntries) : "＋ 變數", {
      active: setEntries.length > 0,
      title: "選了這個選項時要改哪些變數",
    }));

    bar.appendChild(chip("cond", opt.if ? `僅當 ${this.#summarizeCond(opt.if)}` : "＋ 顯示條件", {
      active: !!opt.if,
      title: opt.if ? "這個選項只在條件成立時出現" : "設定後，條件不成立時這個選項不會出現",
    }));

    wrap.appendChild(bar);

    if (openNow === "goto") wrap.appendChild(this.#renderChoiceGoto(opt, idx));
    else if (openNow === "set") wrap.appendChild(this.#renderChoiceSet(opt, idx));
    else if (openNow === "cond") wrap.appendChild(this.#renderChoiceCondition(opt, idx));

    return wrap;
  }

  /** 變數設定的一行摘要，例：好感度 +=5 · 認錯過 */
  #summarizeSet(entries) {
    const parts = entries.slice(0, 2).map(([k, v]) => {
      if (v && typeof v === "object" && "op" in v) return `${k} ${v.op}${v.value}`;
      return v === true ? k : `${k}=${v}`;
    });
    return parts.join(" · ") + (entries.length > 2 ? ` …+${entries.length - 2}` : "");
  }

  /** 條件的一行摘要：拿白話解讀去掉頭尾的「當…時執行。」 */
  #summarizeCond(expr) {
    const s = explainCondition(expr).replace(/^當\s*/, "").replace(/\s*時執行。$/, "");
    return s.length > 24 ? s.slice(0, 24) + "…" : s;
  }

  /** 跳轉目標（展開後才渲染） */
  #renderChoiceGoto(opt, idx) {
    const host = document.createElement("div");
    host.className = "choice-panel";

    const label = document.createElement("label");
    label.textContent = "跳轉到（跳走不回來）：";
    host.appendChild(label);

    const targets = [
      ...this.project.getAllSceneIds(),
      ...this.#getLabelsInCurrentScene(),
    ];
    const input = this.#selectOrInput(opt.goto, targets, "（不跳轉）");
    input.style.minWidth = "160px";
    input.addEventListener("change", (e) => {
      const options = [...this.ins.options];
      options[idx] = { ...options[idx], goto: e.target.value };
      this.onChange({ options });
    });
    host.appendChild(input);
    return host;
  }

  /**
   * 選項的顯示條件：不符合時該選項整個不出現在遊戲裡。
   * 收合與摘要由晶片列負責，這裡只畫展開後的內容。
   */
  #renderChoiceCondition(opt, idx) {
    const wrap = document.createElement("div");
    wrap.className = "choice-panel choice-cond";

    const host = document.createElement("div");
    renderConditionBuilder(host, {
      expr: opt.if || "",
      flags: this.project.getKnownFlagNames(),
      onManage: () => this.onManage?.("flags"),
      onChange: (expr) => {
        const options = [...this.ins.options];
        options[idx] = { ...options[idx], if: expr || undefined };
        this.onChange({ options });
      },
    });
    wrap.appendChild(host);

    // 進階：含括號或「且/或」混用的式子，產生器不敢硬拆（怕改壞），
    // 只會叫人「直接編輯下方文字」——所以下方一定要真的有這個文字框。
    const adv = document.createElement("details");
    adv.className = "cond-adv";
    const advSum = document.createElement("summary");
    advSum.textContent = "進階：直接編輯條件式";
    adv.appendChild(advSum);
    const advInput = document.createElement("input");
    advInput.className = "instr-field condition";
    advInput.value = opt.if || "";
    advInput.placeholder = "條件表達式，例: 對項伯起疑 && 怒氣 > 2";
    advInput.addEventListener("change", () => {
      const options = [...this.ins.options];
      options[idx] = { ...options[idx], if: advInput.value.trim() || undefined };
      this.onChange({ options });
    });
    adv.appendChild(advInput);
    wrap.appendChild(adv);

    return wrap;
  }

  /**
   * 選項的變數設定：圖形化的「變數 ／ 運算子 ／ 值」列，取代原本要手打
   * `flag: true, x: 1` 的純文字框（與 @set 指令同一套操作邏輯）。
   */
  #renderChoiceSet(opt, idx) {
    const wrap = document.createElement("div");
    wrap.className = "choice-panel choice-set";

    const setObj = opt.set || {};
    const entries = Object.entries(setObj);

    const commit = (nextSet) => {
      const options = [...this.ins.options];
      options[idx] = { ...options[idx], set: nextSet };
      this.onChange({ options });
    };

    const head = document.createElement("span");
    head.className = "choice-set-label";
    head.textContent = "選了之後改變數：";
    wrap.appendChild(head);

    for (const [flag, raw] of entries) {
      const isOp = raw && typeof raw === "object" && "op" in raw;
      const op = isOp ? raw.op : "=";
      const val = isOp ? raw.value : raw;

      const row = document.createElement("span");
      row.className = "choice-set-row";

      const flagSel = createSelectField({
        value: flag,
        options: this.project.getKnownFlagNames(),
        placeholder: "選變數",
        addLabel: "新增變數…", onAdd: () => this.onManage?.("flags"),
        onChange: (v) => {
          if (!v || v === flag) return;
          const next = {}; // 保留原順序地換掉 key
          for (const [k, vv] of entries) next[k === flag ? v : k] = vv;
          commit(next);
        },
      });
      flagSel.classList.add("choice-set-flag");
      row.appendChild(flagSel);

      const opSel = document.createElement("select");
      opSel.className = "instr-field choice-set-op";
      for (const o of ["=", "+=", "-="]) {
        const el2 = document.createElement("option");
        el2.value = o; el2.textContent = o;
        if (op === o) el2.selected = true;
        opSel.appendChild(el2);
      }
      opSel.addEventListener("change", () => {
        const next = { ...setObj };
        next[flag] = opSel.value === "="
          ? val
          : { op: opSel.value, value: typeof val === "number" ? val : 1 };
        commit(next);
      });
      row.appendChild(opSel);

      const valIn = document.createElement("input");
      valIn.className = "instr-field choice-set-val";
      valIn.value = String(val);
      valIn.placeholder = "true / 1";
      valIn.addEventListener("change", () => {
        const parsed = this.#parseValue(valIn.value);
        const next = { ...setObj };
        next[flag] = op === "="
          ? parsed
          : { op, value: typeof parsed === "number" ? parsed : 1 };
        commit(next);
      });
      row.appendChild(valIn);

      const rm = document.createElement("button");
      rm.className = "choice-set-del";
      rm.textContent = "×";
      rm.title = "移除這項設定";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = { ...setObj };
        delete next[flag];
        commit(next);
      });
      row.appendChild(rm);

      wrap.appendChild(row);
    }

    const add = document.createElement("button");
    add.className = "choice-set-add";
    add.textContent = "＋ 設定變數";
    add.addEventListener("click", (e) => {
      e.stopPropagation();
      const known = this.project.getKnownFlagNames();
      const pick = known.find((f) => !(f in setObj)) || "";
      commit({ ...setObj, [pick]: true });
    });
    wrap.appendChild(add);

    return wrap;
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
