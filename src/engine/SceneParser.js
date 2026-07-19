// ============================================
// SceneParser.js
// 把 Markdown 劇本解析成可執行的指令序列
// ============================================

/**
 * 指令類型：
 *   text      - 顯示文字 { speaker, text }
 *   directive - 引擎指令 { name, args }
 *   set       - 設定變數 { key, op, value }
 *   if        - 條件開始 { condition, endIndex, elifs[], elseIndex }
 *   endif     - 條件結束
 *   label     - 標籤錨點 { name }
 *   goto      - 跳到標籤或場景 { target }
 *   choice    - 選項 { options: [{text, set, goto}, ...] }
 *   ending    - 結局標記 { id, title }
 */

// 句讀標點：出現在冒號前就不可能是人名（括號不算——「得參(心聲)」是合法名字）
const SENTENCE_PUNCT = /[。，、！？；：…—─《》〈〉「」『』,.!?;]/;
// 未登記角色的保守上限：真實人名幾乎都在 2~4 字，6 留了餘裕
const MAX_UNREGISTERED_NAME = 6;

export class SceneParser {
  /**
   * 判斷冒號前的字串是不是「說話者」。
   *
   * 舊版把任何冒號都當分隔符，導致含冒號的旁白被腰斬
   * （「你解決了一個劉邦，卻教會了所有人：項王的宴席」→ 前半變成人名）。
   * 現在改成宣告優先：
   *   ① 已登記角色（含 `名字(心聲)`、`名字[表情]` 的基底名）→ 一律對話
   *   ② 未登記 → 需「不含句讀標點」且「基底名 ≤6 字」才算對話
   * 其餘一律旁白。想強制寫出冒號旁白可用 `\:` 轉義。
   *
   * @param {string} raw - 冒號前的原始字串
   * @param {Set<string>|Array<string>|null} characters - 已登記角色名
   */
  static isDialogueSpeaker(raw, characters = null) {
    const sp = String(raw ?? "").trim();
    if (!sp) return false;
    if (/^\s/.test(raw)) return false;               // 行首縮排的不算對話
    const base = sp.replace(/\s*[（(\[][^）)\]]*[）)\]]\s*$/, "").trim();
    if (!base) return false;

    const set = this.#charSet(characters);
    if (set && (set.has(sp) || set.has(base))) return true;   // ① 宣告優先

    if (SENTENCE_PUNCT.test(sp)) return false;                // ② 保守啟發式
    return [...base].length <= MAX_UNREGISTERED_NAME;
  }

  static #charSet(characters) {
    if (!characters) return null;
    if (characters instanceof Set) return characters.size ? characters : null;
    if (Array.isArray(characters)) return characters.length ? new Set(characters) : null;
    if (typeof characters === "object") {
      const keys = Object.keys(characters);
      return keys.length ? new Set(keys) : null;
    }
    return null;
  }

  /** 找出第一個「未被 \ 轉義」的冒號；找不到回傳 null */
  static #splitAtColon(line) {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\\") { i++; continue; }              // 跳過被轉義的下一個字元
      if (ch === "：" || ch === ":") {
        const before = line.slice(0, i);
        const after = line.slice(i + 1);
        if (!before.trim() || !after.trim()) return null;
        return { before, after };
      }
    }
    return null;
  }

  /** `\:` / `\：` → 普通冒號（作者用來寫「不想被當成對話」的旁白） */
  static #unescapeColon(text) {
    return text.replace(/\\([：:])/g, "$1");
  }

  /**
   * @param {string} rawText - Markdown 檔案原始內容
   * @param {object} [opts]
   * @param {Set|Array|object} [opts.characters] - 已登記角色（story.json 的 characters）
   * @returns {{meta: Object, instructions: Array}}
   */
  static parse(rawText, { characters = null } = {}) {
    // 去除開頭 BOM：fetch/File.text() 會自動去除，但直接餵字串（如即時預覽）不會
    if (typeof rawText === "string" && rawText.charCodeAt(0) === 0xfeff) {
      rawText = rawText.slice(1);
    }
    // 換行正規化：CRLF 檔的 front matter 會整份失效——外層的 ---...--- 抓得到，
    // 但裡面每一行的 /^key:\s*(.*)$/ 都比不中，因為 JS 的 . 不吃 \r、$ 也不停在 \r 前。
    // 結果是 background／bgm／next／id 全部靜默消失（Windows 上 git 簽出即 CRLF）。
    if (typeof rawText === "string") rawText = rawText.replace(/\r\n?/g, "\n");
    const { meta, body } = this.#extractFrontMatter(rawText);
    const instructions = this.#parseBody(body, characters);
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
  static #parseBody(body, characters = null) {
    const instructions = [];
    const lines = body.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 空行跳過
      if (!trimmed) {
        i++;
        continue;
      }

      // # 註解：保留為指令（作者筆記；引擎執行時 no-op，
      // 原本直接丟棄會導致手寫註解在編輯器存檔後永久消失）
      if (trimmed.startsWith("#")) {
        instructions.push({ type: "comment", text: trimmed.replace(/^#\s?/, "") });
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
        } else if (ctrl.startsWith("block ")) {
          // 具名內容區塊：選項用 do: 進來，跑到 endblock 再回到呼叫點的下一句。
          // 平常線性執行到這裡會整段跳過（區塊只有被呼叫時才執行）。
          instructions.push({ type: "block", name: ctrl.slice(6).trim() });
        } else if (ctrl === "endblock") {
          instructions.push({ type: "endblock" });
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

      // 對話：格式 "角色名: 文字"，或帶當句表情的 "角色名[表情]: 文字"
      //
      // 表情用方括號而非小括號：既有劇本大量把小括號當成名字的一部分
      // （例如「得參(心聲):」），若改判成表情會讓顯示名稱憑空少一截。
      //
      // 只有 isDialogueSpeaker 認可的才算對話，其餘（含冒號的旁白）落到下面。
      const split = this.#splitAtColon(line);
      if (split && this.isDialogueSpeaker(split.before, characters)) {
        let speaker = split.before.trim();
        let emotion = null;
        const emoMatch = speaker.match(/^(.*?)\s*\[([^\][]+)\]$/);
        if (emoMatch) {
          speaker = emoMatch[1].trim();
          emotion = emoMatch[2].trim();
        }
        const ins = { type: "text", speaker, text: this.#unescapeColon(split.after.trim()) };
        if (emotion) ins.emotion = emotion;   // 當句切換該角色立繪的表情
        instructions.push(ins);
        i++;
        continue;
      }

      // 純旁白（含「有冒號但不是對話」的句子）
      instructions.push({
        type: "text",
        speaker: "",
        text: this.#unescapeColon(trimmed),
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

    // 通用指令：@name arg1 "多 字 參數" key=value key="value with space"
    // 引號內的空白不切段（S6c：@float 的文字內容需要）
    const tokens = str.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const name = tokens.shift();
    const args = { positional: [] };
    for (const tok of tokens) {
      const eq = tok.indexOf("=");
      // k=v：k 必須是識別字，且 token 不是以引號開頭（那是帶引號的 positional）
      if (eq > 0 && !/^["']/.test(tok) && /^[A-Za-z_]\w*$/.test(tok.slice(0, eq))) {
        args[tok.slice(0, eq)] = this.#parseValue(tok.slice(eq + 1));
      } else {
        args.positional.push(this.#unquote(tok));
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
        // 條件選項：不符合條件時整個選項不顯示（沒寫就一律顯示）
        const ifMatch = trimmed.match(/^if\s*:\s*(.+)$/);
        if (ifMatch) {
          current.if = ifMatch[1].trim();
          i++;
          continue;
        }
        // 內容區塊：選了這個選項就先跑該區塊，跑完回到選項節點的下一句
        const doMatch = trimmed.match(/^do\s*:\s*(.+)$/);
        if (doMatch) {
          current.do = doMatch[1].trim();
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
        result[m[1]] = this.#parseOpValue(m[2].trim());
      }
    }
    return result;
  }

  /**
   * 解析選項 set 的右值：
   *   `true` / `5` / `"文字"`  → 直接賦值（維持舊語意）
   *   `+= 1` / `-= 2`          → 增量物件 { op, value }（供引擎套用時做加減）
   * 非數字的增量無意義，退回當一般賦值處理。
   */
  static #parseOpValue(raw) {
    const opMatch = raw.match(/^(\+=|-=)\s*(.+)$/);
    if (opMatch) {
      const num = this.#parseValue(opMatch[2].trim());
      if (typeof num === "number") {
        return { op: opMatch[1], value: num };
      }
    }
    return this.#parseValue(raw);
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

  /** 去除成對的外層引號（不動內部） */
  static #unquote(s) {
    if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
      return s.slice(1, -1);
    }
    return s;
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
   * 重建 if/elif/else/endif 的跳轉索引。
   * parse() 內部會自動呼叫；從 JSON 還原 AST 時需手動呼叫（那些索引是推導值，不序列化）。
   */
  static link(instructions) {
    this.#linkControlFlow(instructions);
    return instructions;
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

    this.#linkBlocks(instructions);
  }

  /**
   * 建立 block/endblock 的配對索引。
   * 區塊不巢狀（一個區塊裡要再分支就自己再開一個具名區塊），所以用單一游標
   * 掃過去即可；沒有配對的 endblock 就忽略，缺 endblock 的區塊算到陣列尾端。
   */
  static #linkBlocks(instructions) {
    let openIdx = -1;
    for (let i = 0; i < instructions.length; i++) {
      const ins = instructions[i];
      if (ins.type === "block") {
        // 前一個區塊沒收尾就直接開下一個：讓它結束在這裡，不要吃掉後面的區塊
        if (openIdx >= 0) instructions[openIdx].endIndex = i - 1;
        openIdx = i;
        ins.endIndex = instructions.length;   // 預設值，遇到 endblock 會覆蓋
      } else if (ins.type === "endblock") {
        if (openIdx >= 0) {
          instructions[openIdx].endIndex = i;
          ins.openerIndex = openIdx;
          openIdx = -1;
        }
      }
    }
  }
}
