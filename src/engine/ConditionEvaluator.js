// ============================================
// ConditionEvaluator.js
// 安全地評估條件表達式（不使用 eval）
// 支援：== != > < >= <= && || ! ( ) 數字 字串 布林
// 例：met_alice_before && charm > 2
// ============================================

export class ConditionEvaluator {
  /**
   * @param {string} expr - 條件表達式
   * @param {Object} flags - 當前所有旗標
   * @returns {boolean}
   */
  static eval(expr, flags) {
    if (!expr || !expr.trim()) return true;
    try {
      const tokens = this.#tokenize(expr);
      const { value } = this.#parseOr(tokens, 0, flags);
      return Boolean(value);
    } catch (e) {
      console.error(`[ConditionEvaluator] 解析失敗: "${expr}"`, e);
      return false;
    }
  }

  static #tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const c = expr[i];
      if (/\s/.test(c)) { i++; continue; }

      // 多字元運算子
      const two = expr.slice(i, i + 2);
      if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
        tokens.push({ type: "op", value: two });
        i += 2;
        continue;
      }

      // 單字元運算子
      if ("()!<>".includes(c)) {
        tokens.push({ type: c === "(" || c === ")" ? c : "op", value: c });
        i++;
        continue;
      }

      // 字串
      if (c === '"' || c === "'") {
        let end = i + 1;
        while (end < expr.length && expr[end] !== c) end++;
        tokens.push({ type: "string", value: expr.slice(i + 1, end) });
        i = end + 1;
        continue;
      }

      // 數字
      if (/\d/.test(c) || (c === "-" && /\d/.test(expr[i + 1] || ""))) {
        let end = i + (c === "-" ? 1 : 0);
        while (end < expr.length && /[\d.]/.test(expr[end])) end++;
        tokens.push({ type: "number", value: parseFloat(expr.slice(i, end)) });
        i = end;
        continue;
      }

      // 識別字（變數名、true、false）— 支援中文
      // \u4e00-\u9fff: CJK 統一漢字
      // \u3400-\u4dbf: CJK 擴充 A
      // \uf900-\ufaff: CJK 相容漢字
      if (/[a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(c)) {
        let end = i;
        while (end < expr.length && /[\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(expr[end])) end++;
        const id = expr.slice(i, end);
        if (id === "true") tokens.push({ type: "bool", value: true });
        else if (id === "false") tokens.push({ type: "bool", value: false });
        else tokens.push({ type: "ident", value: id });
        i = end;
        continue;
      }

      throw new Error(`非預期字元: ${c}`);
    }
    return tokens;
  }

  // 解析器：遞迴下降法
  static #parseOr(tokens, pos, flags) {
    let { value: left, pos: p } = this.#parseAnd(tokens, pos, flags);
    while (p < tokens.length && tokens[p].value === "||") {
      const right = this.#parseAnd(tokens, p + 1, flags);
      left = left || right.value;
      p = right.pos;
    }
    return { value: left, pos: p };
  }

  static #parseAnd(tokens, pos, flags) {
    let { value: left, pos: p } = this.#parseNot(tokens, pos, flags);
    while (p < tokens.length && tokens[p].value === "&&") {
      const right = this.#parseNot(tokens, p + 1, flags);
      left = left && right.value;
      p = right.pos;
    }
    return { value: left, pos: p };
  }

  static #parseNot(tokens, pos, flags) {
    if (pos < tokens.length && tokens[pos].value === "!") {
      const r = this.#parseNot(tokens, pos + 1, flags);
      return { value: !r.value, pos: r.pos };
    }
    return this.#parseComp(tokens, pos, flags);
  }

  static #parseComp(tokens, pos, flags) {
    let { value: left, pos: p } = this.#parsePrim(tokens, pos, flags);
    if (p < tokens.length && ["==", "!=", ">", "<", ">=", "<="].includes(tokens[p].value)) {
      const op = tokens[p].value;
      const r = this.#parsePrim(tokens, p + 1, flags);
      let result;
      switch (op) {
        case "==": result = left == r.value; break;
        case "!=": result = left != r.value; break;
        case ">": result = left > r.value; break;
        case "<": result = left < r.value; break;
        case ">=": result = left >= r.value; break;
        case "<=": result = left <= r.value; break;
      }
      return { value: result, pos: r.pos };
    }
    return { value: left, pos: p };
  }

  static #parsePrim(tokens, pos, flags) {
    const tok = tokens[pos];
    if (!tok) throw new Error("unexpected end");

    if (tok.type === "(") {
      const r = this.#parseOr(tokens, pos + 1, flags);
      if (tokens[r.pos]?.type !== ")") throw new Error("missing )");
      return { value: r.value, pos: r.pos + 1 };
    }
    if (tok.type === "number" || tok.type === "string" || tok.type === "bool") {
      return { value: tok.value, pos: pos + 1 };
    }
    if (tok.type === "ident") {
      // 從旗標查詢；未定義視為 undefined -> falsy
      const v = flags[tok.value];
      return { value: v === undefined ? false : v, pos: pos + 1 };
    }
    throw new Error(`unexpected token: ${JSON.stringify(tok)}`);
  }
}
