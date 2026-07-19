// ============================================
// conditionBuilder.js
// 條件式的圖形化產生器 ＋ 白話解讀。
//
// 動機：條件欄位原本是自由輸入框，作者得自己想出
// `met_alice && charm > 2` 這種語法。這裡提供一排「變數／運算子／值」的
// 條件塊，自動組出運算式；文字框保留為進階模式，兩邊雙向同步。
//
// 刻意的限制：只解析「以單一邏輯運算子串起來的比較式」。含括號或 && ||
// 混用的式子無法安全還原成積木，這時退回純文字模式而不是硬拆——
// 寧可讓作者用文字編輯，也不能把他寫好的條件改壞。
// ============================================

import { createSelectField } from "./selectField.js";

const COMPARE_OPS = [
  ["", "為真"],          // 只有變數名，例：met_alice
  ["!", "為假"],         // !met_alice
  ["==", "等於"],
  ["!=", "不等於"],
  [">", "大於"],
  [">=", "大於等於"],
  ["<", "小於"],
  ["<=", "小於等於"],
];
const OP_LABEL = Object.fromEntries(COMPARE_OPS);

/** 值的字面呈現（字串加引號，其餘原樣） */
function fmtValue(v) {
  if (typeof v === "string" && !/^-?\d+(\.\d+)?$/.test(v) && !["true", "false"].includes(v)) {
    return `"${v}"`;
  }
  return String(v);
}

/**
 * 把運算式拆成條件塊。無法安全拆解時回傳 null（呼叫端應退回純文字模式）。
 * @returns {{ join: "&&"|"||", parts: Array<{flag,op,value}> }|null}
 */
export function parseCondition(expr) {
  const s = String(expr || "").trim();
  if (!s) return { join: "&&", parts: [] };
  if (/[()]/.test(s)) return null;                       // 有括號 → 不硬拆
  const hasAnd = /&&/.test(s), hasOr = /\|\|/.test(s);
  if (hasAnd && hasOr) return null;                      // 混用 → 不硬拆
  const join = hasOr ? "||" : "&&";

  const parts = [];
  for (const seg of s.split(hasOr ? "||" : "&&")) {
    const t = seg.trim();
    if (!t) return null;
    // flag op value
    const m = t.match(/^([A-Za-z_一-鿿][\w一-鿿]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (m) {
      parts.push({ flag: m[1], op: m[2], value: m[3].trim().replace(/^["']|["']$/g, "") });
      continue;
    }
    // !flag
    const neg = t.match(/^!\s*([A-Za-z_一-鿿][\w一-鿿]*)$/);
    if (neg) { parts.push({ flag: neg[1], op: "!", value: "" }); continue; }
    // flag（單獨出現＝為真）
    const bare = t.match(/^([A-Za-z_一-鿿][\w一-鿿]*)$/);
    if (bare) { parts.push({ flag: bare[1], op: "", value: "" }); continue; }
    return null;                                          // 看不懂 → 不硬拆
  }
  return { join, parts };
}

/** 條件塊 → 運算式 */
export function buildCondition({ join, parts }) {
  const segs = parts
    .filter((p) => p.flag)
    .map((p) => {
      if (p.op === "") return p.flag;
      if (p.op === "!") return `!${p.flag}`;
      return `${p.flag} ${p.op} ${fmtValue(p.value)}`;
    });
  return segs.join(` ${join} `);
}

/** 把運算式翻成白話，讓非程式背景的作者看得懂自己寫了什麼 */
export function explainCondition(expr) {
  const parsed = parseCondition(expr);
  if (!expr || !String(expr).trim()) return "沒有條件，這段一定會執行。";
  if (!parsed) return "這個條件較複雜，無法自動解讀（仍會正常運作）。";
  if (!parsed.parts.length) return "沒有條件，這段一定會執行。";
  const joiner = parsed.join === "||" ? "或" : "且";
  const items = parsed.parts.map((p) => {
    if (p.op === "") return `「${p.flag}」為真`;
    if (p.op === "!") return `「${p.flag}」為假`;
    return `「${p.flag}」${OP_LABEL[p.op]} ${p.value}`;
  });
  return `當 ${items.join(`，${joiner} `)} 時執行。`;
}

/**
 * 渲染條件產生器。
 * @param {HTMLElement} host
 * @param {object} o
 * @param {string} o.expr            目前的運算式
 * @param {string[]} o.flags         可選變數
 * @param {(expr:string)=>void} o.onChange
 * @param {()=>void} [o.onManage]    「新增變數…」的跳轉
 */
export function renderConditionBuilder(host, { expr, flags = [], onChange, onManage }) {
  const initial = String(expr || "");
  const parsed = parseCondition(initial);

  // 剛加入、還沒選變數的那一列算出來是空字串。若照樣往外層送，外層會判定
  // 「這個選項沒有條件」而整塊重繪，剛加的列當場消失——於是永遠加不出條件。
  // 所以運算式沒有實際變化時只重畫自己，不驚動外層。
  const state = parsed ? { join: parsed.join, parts: [...parsed.parts] } : null;
  const commit = () => {
    const next = buildCondition(state);
    if (next === initial) draw();
    else onChange(next);
  };

  function draw() {
    host.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "cond-builder";

    if (!state) {
      // 進階式子：不提供積木，避免把作者寫好的條件改壞
      const note = document.createElement("div");
      note.className = "cond-advanced";
      note.textContent = "這個條件較複雜（含括號或混用「且/或」），請直接編輯下方文字。";
      wrap.appendChild(note);
    } else {
      const rows = document.createElement("div");
      rows.className = "cond-rows";

      state.parts.forEach((part, i) => {
        const row = document.createElement("div");
        row.className = "cond-row";

        if (i > 0) {
          const joinSel = document.createElement("select");
          joinSel.className = "instr-field cond-join";
          for (const [v, t] of [["&&", "且"], ["||", "或"]]) {
            const o = document.createElement("option");
            o.value = v; o.textContent = t;
            if (state.join === v) o.selected = true;
            joinSel.appendChild(o);
          }
          // 一次改全部（同一串條件只用一種連接詞，避免產生需要括號的式子）
          joinSel.addEventListener("change", () => { state.join = joinSel.value; commit(); });
          row.appendChild(joinSel);
        } else {
          const spacer = document.createElement("span");
          spacer.className = "cond-join-spacer";
          spacer.textContent = "當";
          row.appendChild(spacer);
        }

        const flagSel = createSelectField({
          value: part.flag, options: flags, placeholder: "選變數",
          addLabel: "新增變數…", onAdd: () => onManage?.(),
          onChange: (v) => { part.flag = v; commit(); },
        });
        flagSel.classList.add("cond-flag");
        row.appendChild(flagSel);

        const opSel = document.createElement("select");
        opSel.className = "instr-field cond-op";
        for (const [v, t] of COMPARE_OPS) {
          const o = document.createElement("option");
          o.value = v; o.textContent = t;
          if (part.op === v) o.selected = true;
          opSel.appendChild(o);
        }
        opSel.addEventListener("change", () => {
          part.op = opSel.value;
          if ((part.op === "" || part.op === "!")) part.value = "";
          else if (!part.value) part.value = "0";
          commit();
        });
        row.appendChild(opSel);

        // 「為真/為假」不需要值
        if (part.op !== "" && part.op !== "!") {
          const valIn = document.createElement("input");
          valIn.className = "instr-field cond-val";
          valIn.value = part.value ?? "";
          valIn.placeholder = "值";
          valIn.addEventListener("change", () => { part.value = valIn.value; commit(); });
          row.appendChild(valIn);
        }

        const del = document.createElement("button");
        del.className = "cond-del";
        del.textContent = "×";
        del.title = "移除這個條件";
        del.addEventListener("click", () => { state.parts.splice(i, 1); commit(); });
        row.appendChild(del);

        rows.appendChild(row);
      });

      wrap.appendChild(rows);

      const add = document.createElement("button");
      add.className = "cond-add";
      add.textContent = "＋ 加入條件";
      add.addEventListener("click", () => {
        // 留空讓作者自己挑：預設帶第一個變數會生出「A && A」這種重複式子
        state.parts.push({ flag: "", op: "", value: "" });
        commit();
      });
      wrap.appendChild(add);
    }

    // 白話解讀：永遠顯示，讓作者確認自己寫的跟想的一致。
    // 讀 state 而非 initial，半成品階段才不會顯示成「沒有條件」。
    const explain = document.createElement("div");
    explain.className = "cond-explain";
    explain.textContent = state
      ? explainCondition(buildCondition(state))
      : explainCondition(initial);
    wrap.appendChild(explain);

    host.appendChild(wrap);
  }

  draw();
}
