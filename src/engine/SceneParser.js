// ============================================
// SceneParser.js
// 把 Markdown 劇本解析成可執行的指令序列
// ============================================

/**
 * 指令類型：
 *   text      - 顯示文字 { speaker, text }
 *   directive - 引擎指令 { name, args }
 *   set       - 設定旗標 { key, op, value }
 *   if        - 條件開始 { condition, endIndex, elifs[], elseIndex }
 *   endif     - 條件結束
 *   label     - 標籤錨點 { name }
 *   goto      - 跳到標籤或場景 { target }
 *   choice    - 選項 { options: [{text, set, goto}, ...] }
 *   ending    - 結局標記 { id, title }
 */

export class SceneParser {
  /**
   * @param {string} rawText - Markdown 檔案原始內容
   * @returns {{meta: Object, instructions: Array}}
   */
  static parse(rawText) {
    const { meta, body } = this.#extractFrontMatter(rawText);
    const instructions = this.#parseBody(body);
    this.#linkControlFlow(instructions);
    return { meta, instructions };
  }

  /**
   * 解析 YAML-like front matter
   */
  static #extractFrontMatter(raw) {
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) {
      return { meta: {}, body: raw };
    }
    const meta = {};
    const lines = match[1].split("\n");
    for (const line of lines) {
      const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
      if (m) {
        let value = m[2].trim();
        // 嘗試轉換類型
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (/^-?\d+$/.test(value)) value = parseInt(value, 10);
        else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value);
        else value = value.replace(/^["']|["']$/g, "");
        meta[m[1]] = value;
      }
    }
    return { meta, body: match[2] };
  }

  /**
   * 把本文逐行轉成指令陣列
   */
  static #parseBody(body) {
    const instructions = [];
    const lines = body.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 空行與註解
      if (!trimmed || trimmed.startsWith("#")) {
        i++;
        continue;
      }

      // @ 指令（畫面操作）
      if (trimmed.startsWith("@")) {
        instructions.push(this.#parseDirective(trimmed.slice(1)));
        i++;
        continue;
      }

      // :: 控制流程
      if (trimmed.startsWith("::")) {
        const ctrl = trimmed.slice(2).trim();
        if (ctrl.startsWith("if ")) {
          instructions.push({ type: "if", condition: ctrl.slice(3).trim() });
        } else if (ctrl.startsWith("elif ")) {
          instructions.push({ type: "elif", condition: ctrl.slice(5).trim() });
        } else if (ctrl === "else") {
          instructions.push({ type: "else" });
        } else if (ctrl === "endif") {
          instructions.push({ type: "endif" });
        } else if (ctrl.startsWith("label ")) {
          instructions.push({ type: "label", name: ctrl.slice(6).trim() });
        }
        i++;
        continue;
      }

      // ?? 選項區塊
      if (trimmed === "?? choice" || trimmed.startsWith("?? choice")) {
        const { choice, consumed } = this.#parseChoice(lines, i);
        instructions.push(choice);
        i += consumed;
        continue;
      }

      // 對話：格式 "角色名: 文字" 或 "角色名(狀態): 文字"
      const dialogMatch = line.match(/^([^\s：:][^：:]*?)[：:]\s*(.+)$/);
      if (dialogMatch) {
        instructions.push({
          type: "text",
          speaker: dialogMatch[1].trim(),
          text: dialogMatch[2].trim(),
        });
        i++;
        continue;
      }

      // 純旁白
      instructions.push({
        type: "text",
        speaker: "",
        text: trimmed,
      });
      i++;
    }

    return instructions;
  }

  /**
   * 解析 @ 指令: @bg cafe.jpg fade=1000 或 @show alice center happy
   */
  static #parseDirective(str) {
    // 處理 @set flag = value
    if (str.startsWith("set ")) {
      const setExpr = str.slice(4).trim();
      const m = setExpr.match(/^([a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*)\s*(=|\+=|-=)\s*(.+)$/);
      if (m) {
        return {
          type: "set",
          key: m[1],
          op: m[2],
          value: this.#parseValue(m[3].trim()),
        };
      }
    }

    // 處理 @goto target
    if (str.startsWith("goto ")) {
      return { type: "goto", target: str.slice(5).trim() };
    }

    // 處理 @ending id="ending_happy" title="幸福結局"
    if (str.startsWith("ending")) {
      const rest = str.slice(6).trim();
      const args = this.#parseArgs(rest);
      return { type: "ending", id: args.id, title: args.title, desc: args.desc };
    }

    // 通用指令：@name arg1 arg2 key=value
    const parts = str.split(/\s+/);
    const name = parts.shift();
    const args = { positional: [] };
    for (const part of parts) {
      if (part.includes("=")) {
        const [k, v] = part.split("=");
        args[k] = this.#parseValue(v);
      } else {
        args.positional.push(part);
      }
    }
    return { type: "directive", name, args };
  }

  /**
   * 解析選項區塊：
   * ?? choice
   * - text: "選項一"
   *   set: { flag: true, charm: +1 }
   *   goto: label_a
   * ??
   */
  static #parseChoice(lines, startIdx) {
    const options = [];
    let current = null;
    let consumed = 1;
    let i = startIdx + 1;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "??") {
        consumed = i - startIdx + 1;
        break;
      }

      // 新選項開始：- text: "..."
      const textMatch = trimmed.match(/^-\s*text\s*:\s*(.+)$/);
      if (textMatch) {
        if (current) options.push(current);
        current = {
          text: this.#parseValue(textMatch[1].trim()),
          set: {},
          goto: null,
        };
        i++;
        continue;
      }

      // 選項屬性
      if (current) {
        const setMatch = trimmed.match(/^set\s*:\s*(.+)$/);
        if (setMatch) {
          current.set = this.#parseInlineObject(setMatch[1].trim());
          i++;
          continue;
        }
        const gotoMatch = trimmed.match(/^goto\s*:\s*(.+)$/);
        if (gotoMatch) {
          current.goto = gotoMatch[1].trim();
          i++;
          continue;
        }
      }

      i++;
    }

    if (current) options.push(current);
    return { choice: { type: "choice", options }, consumed };
  }

  /**
   * 解析 { flag: true, charm: +1 } 這種簡單 object 語法
   */
  static #parseInlineObject(str) {
    const result = {};
    const inner = str.replace(/^\{|\}$/g, "").trim();
    if (!inner) return result;
    // 分割逗號（簡易版，不支援巢狀）
    const parts = inner.split(",");
    for (const part of parts) {
      const m = part.match(/^\s*([a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*)\s*:\s*(.+)\s*$/);
      if (m) {
        result[m[1]] = this.#parseValue(m[2].trim());
      }
    }
    return result;
  }

  /**
   * 解析 key="value" 風格的參數
   */
  static #parseArgs(str) {
    const result = {};
    const regex = /([a-zA-Z_]\w*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let m;
    while ((m = regex.exec(str)) !== null) {
      result[m[1]] = this.#parseValue(m[2] ?? m[3] ?? m[4]);
    }
    return result;
  }

  /**
   * 值類型轉換
   */
  static #parseValue(v) {
    if (typeof v !== "string") return v;
    v = v.trim();
    if (v === "true") return true;
    if (v === "false") return false;
    if (v === "null") return null;
    // 帶號數字：+1, -2
    if (/^[+-]?\d+$/.test(v)) return parseInt(v, 10);
    if (/^[+-]?\d+\.\d+$/.test(v)) return parseFloat(v);
    // 字串（去引號）
    return v.replace(/^["']|["']$/g, "");
  }

  /**
   * 建立 if/elif/else/endif 的跳轉索引
   */
  static #linkControlFlow(instructions) {
    const stack = [];
    for (let i = 0; i < instructions.length; i++) {
      const ins = instructions[i];
      if (ins.type === "if") {
        stack.push({ start: i, branches: [{ type: "if", index: i, condition: ins.condition }] });
      } else if (ins.type === "elif") {
        if (stack.length > 0) {
          stack[stack.length - 1].branches.push({ type: "elif", index: i, condition: ins.condition });
        }
      } else if (ins.type === "else") {
        if (stack.length > 0) {
          stack[stack.length - 1].branches.push({ type: "else", index: i });
        }
      } else if (ins.type === "endif") {
        if (stack.length > 0) {
          const ctx = stack.pop();
          // 回填每個分支的結束位置
          const startIf = instructions[ctx.start];
          startIf.endIndex = i;
          startIf.branches = ctx.branches;
          // 同時標記 elif/else 的結束
          for (const b of ctx.branches) {
            instructions[b.index].endIndex = i;
            instructions[b.index].branches = ctx.branches;
          }
          ins.openerIndex = ctx.start;
        }
      }
    }
  }
}
