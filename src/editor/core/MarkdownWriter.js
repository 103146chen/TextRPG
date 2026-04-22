// ============================================
// MarkdownWriter.js
// 把 { meta, instructions } 序列化回 Markdown 劇本
// 目標：從 SceneParser.parse(md).結果 能往返轉換為乾淨的 md
// ============================================

export class MarkdownWriter {
  /**
   * @param {{meta: Object, instructions: Array}} sceneData
   * @returns {string} Markdown 文字
   */
  static write(sceneData) {
    const { meta, instructions } = sceneData;
    const parts = [];

    // 1. Front matter
    parts.push(this.#writeFrontMatter(meta));
    parts.push("");

    // 2. 本文
    parts.push(this.#writeInstructions(instructions));

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

  static #writeInstructions(instructions) {
    const lines = [];
    for (let i = 0; i < instructions.length; i++) {
      const ins = instructions[i];
      const prev = instructions[i - 1];

      if (this.#needsBlankLineBefore(ins, prev)) {
        lines.push("");
      }

      lines.push(this.#writeInstruction(ins, ""));
    }
    return lines.join("\n");
  }

  static #needsBlankLineBefore(cur, prev) {
    if (!prev) return false;
    // 選項區塊前後空行
    if (cur.type === "choice" || prev?.type === "choice") return true;
    // label 前空行
    if (cur.type === "label") return true;
    // @goto 前空行
    if (cur.type === "goto") return true;
    // if 之前空行
    if (cur.type === "if") return true;
    return false;
  }

  static #writeInstruction(ins, indent) {
    switch (ins.type) {
      case "text":
        if (ins.speaker) {
          return `${indent}${ins.speaker}: ${ins.text}`;
        }
        return `${indent}${ins.text}`;

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
      parts.push(String(p));
    }
    for (const [k, v] of Object.entries(args)) {
      if (k === "positional") continue;
      parts.push(`${k}=${this.#formatValue(v, { keyValue: true })}`);
    }
    return parts.join(" ");
  }

  static #writeChoice(ins, indent) {
    const lines = [`${indent}?? choice`];
    for (const opt of ins.options) {
      lines.push(`${indent}- text: ${this.#quoteIfNeeded(opt.text)}`);
      if (opt.set && Object.keys(opt.set).length > 0) {
        const entries = Object.entries(opt.set)
          .map(([k, v]) => `${k}: ${this.#formatValue(v)}`)
          .join(", ");
        lines.push(`${indent}  set: { ${entries} }`);
      }
      if (opt.goto) {
        lines.push(`${indent}  goto: ${opt.goto}`);
      }
    }
    lines.push(`${indent}??`);
    return lines.join("\n");
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
