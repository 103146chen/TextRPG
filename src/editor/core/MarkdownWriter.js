// ============================================
// MarkdownWriter.js
// 把 { meta, instructions } 序列化回 Markdown 劇本
// 目標：從 SceneParser.parse(md).結果 能往返轉換為乾淨的 md
// ============================================

import { SceneParser } from "../../engine/SceneParser.js";

export class MarkdownWriter {
  /**
   * @param {{meta: Object, instructions: Array}} sceneData
   * @param {object} [opts]
   * @param {Set|Array|object} [opts.characters] - 已登記角色；供旁白冒號轉義判斷
   * @returns {string} Markdown 文字
   */
  static write(sceneData, { characters = null } = {}) {
    const { meta, instructions } = sceneData;
    const parts = [];

    // 1. Front matter
    parts.push(this.#writeFrontMatter(meta));
    parts.push("");

    // 2. 本文
    parts.push(this.#writeInstructions(instructions, characters));

    return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  }

  static #writeFrontMatter(meta) {
    const lines = ["---"];
    // 欄位固定順序，避免 diff 抖動
    const order = ["id", "title", "background", "bgm", "next", "ending"];
    const seen = new Set();
    for (const key of order) {
      if (meta[key] !== undefined) {
        lines.push(`${key}: ${this.#formatMetaValue(meta[key])}`);
        seen.add(key);
      }
    }
    for (const [k, v] of Object.entries(meta)) {
      if (!seen.has(k)) {
        lines.push(`${k}: ${this.#formatMetaValue(v)}`);
      }
    }
    lines.push("---");
    return lines.join("\n");
  }

  static #formatMetaValue(v) {
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (v === null) return "null";
    // 字串：若含特殊字元則加引號
    const s = String(v);
    if (/[:#&*!|>'"%@`]/.test(s) || s.trim() !== s) {
      return `"${s.replace(/"/g, '\\"')}"`;
    }
    return s;
  }

  static #writeInstructions(instructions, characters = null) {
    const lines = [];
    for (let i = 0; i < instructions.length; i++) {
      const ins = instructions[i];
      const prev = instructions[i - 1];

      if (this.#needsBlankLineBefore(ins, prev)) {
        lines.push("");
      }

      lines.push(this.#writeInstruction(ins, "", characters));
    }
    return lines.join("\n");
  }

  /** 旁白轉義：只在「寫出去會被讀成對話」時，把第一個冒號轉義掉 */
  static #escapeNarration(text, characters) {
    const str = String(text ?? "");
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "\\") { i++; continue; }
      if (ch === "：" || ch === ":") {
        const before = str.slice(0, i);
        const after = str.slice(i + 1);
        if (!before.trim() || !after.trim()) return str;
        if (SceneParser.isDialogueSpeaker(before, characters)) {
          return `${before}\\${ch}${after}`;
        }
        return str;
      }
    }
    return str;
  }

  static #needsBlankLineBefore(cur, prev) {
    if (!prev) return false;
    // 選項區塊前後空行
    if (cur.type === "choice" || prev?.type === "choice") return true;
    // label 前空行
    if (cur.type === "label") return true;
    // 區塊自成一段，前後都留空行才看得出邊界
    if (cur.type === "block" || prev?.type === "endblock") return true;
    // @goto 前空行
    if (cur.type === "goto") return true;
    // if 之前空行
    if (cur.type === "if") return true;
    return false;
  }

  static #writeInstruction(ins, indent, characters = null) {
    switch (ins.type) {
      case "text":
        if (ins.speaker) {
          // 當句表情寫成 "角色名[表情]: 文字"（與 SceneParser 對應）
          const who = ins.emotion ? `${ins.speaker}[${ins.emotion}]` : ins.speaker;
          return `${indent}${who}: ${ins.text}`;
        }
        // 旁白若含冒號、且冒號前那截會被讀成說話者，寫出去就會變對話。
        // 轉義成 `\:` 讓 parser 知道那是普通冒號（往返才閉環）。
        return `${indent}${this.#escapeNarration(ins.text, characters)}`;

      case "directive":
        return `${indent}${this.#writeDirective(ins)}`;

      case "set":
        return `${indent}@set ${ins.key} ${ins.op} ${this.#formatSetValue(ins.value)}`;

      case "goto":
        return `${indent}@goto ${ins.target}`;

      case "ending": {
        const parts = [`@ending`];
        if (ins.id) parts.push(`id="${ins.id}"`);
        if (ins.title) parts.push(`title="${ins.title}"`);
        if (ins.desc) parts.push(`desc="${ins.desc}"`);
        return `${indent}${parts.join(" ")}`;
      }

      case "if":
        return `${indent}:: if ${ins.condition}`;

      case "elif":
        return `${indent}:: elif ${ins.condition}`;

      case "else":
        return `${indent}:: else`;

      case "endif":
        return `${indent}:: endif`;

      case "label":
        return `${indent}:: label ${ins.name}`;

      case "block":
        return `${indent}:: block ${ins.name}`;

      case "endblock":
        return `${indent}:: endblock`;

      case "choice":
        return this.#writeChoice(ins, indent);

      case "comment":
        return `${indent}# ${ins.text}`;

      case "blank":
        return "";

      default:
        return `${indent}# [unknown: ${ins.type}]`;
    }
  }

  static #writeDirective(ins) {
    const parts = [`@${ins.name}`];
    const args = ins.args || {};
    for (const p of args.positional || []) {
      parts.push(this.#quoteDirectiveToken(String(p)));
    }
    for (const [k, v] of Object.entries(args)) {
      if (k === "positional") continue;
      const fv = this.#formatValue(v, { keyValue: true });
      parts.push(`${k}=${this.#quoteDirectiveToken(fv)}`);
    }
    return parts.join(" ");
  }

  // 含空白的指令參數要加引號，parser 才不會切段（與 #parseDirective 對稱）
  static #quoteDirectiveToken(s) {
    if (/\s/.test(s) && !/^["'].*["']$/.test(s)) return `"${s}"`;
    return s;
  }

  static #writeChoice(ins, indent) {
    const lines = [`${indent}?? choice`];
    for (const opt of ins.options) {
      lines.push(`${indent}- text: ${this.#quoteIfNeeded(opt.text)}`);
      if (opt.set && Object.keys(opt.set).length > 0) {
        const entries = Object.entries(opt.set)
          .map(([k, v]) => `${k}: ${this.#formatSetEntryValue(v)}`)
          .join(", ");
        lines.push(`${indent}  set: { ${entries} }`);
      }
      if (opt.if) {
        lines.push(`${indent}  if: ${opt.if}`);
      }
      if (opt.do) {
        lines.push(`${indent}  do: ${opt.do}`);
      }
      if (opt.goto) {
        lines.push(`${indent}  goto: ${opt.goto}`);
      }
    }
    lines.push(`${indent}??`);
    return lines.join("\n");
  }

  // 選項 set 的單項：{ op, value } 輸出成 "+= 1"，其餘照一般值
  static #formatSetEntryValue(v) {
    if (v && typeof v === "object" && "op" in v) {
      return `${v.op} ${this.#formatValue(v.value)}`;
    }
    return this.#formatValue(v);
  }

  static #formatSetValue(v) {
    // set 指令的值：純字面
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (v === null) return "null";
    return `"${String(v).replace(/"/g, '\\"')}"`;
  }

  static #formatValue(v, { keyValue = false } = {}) {
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (v === null) return "null";
    const s = String(v);
    if (keyValue) {
      if (/[\s"']/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
      return s;
    }
    if (typeof v === "string") return `"${s.replace(/"/g, '\\"')}"`;
    return s;
  }

  static #quoteIfNeeded(s) {
    // 選項 text 就是字串，不需要額外引號（它不是 key-value 格式）
    return String(s);
  }
}
