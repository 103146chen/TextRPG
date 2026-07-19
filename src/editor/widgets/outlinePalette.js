// ============================================
// outlinePalette.js
// 場景內大綱：只列「結構地標」，快捷鍵呼出，選了就跳過去。
//
// 動機：一個場景動輒 80 條指令、捲動高度超過 10 個螢幕（實測 scene_07 為
// 6260px / 700px），除了捲動之外沒有任何導覽手段；具名內容區塊也只能從
// 選項或流程中的摘要卡找到，沒有地方可以一眼看完。
//
// 刻意不列每一句對話：那會讓清單長到跟劇本一樣，失去「快速定位」的意義。
// ============================================

import { openModal } from "./dialog.js";
import { explainCondition } from "./conditionBuilder.js";

const KINDS = {
  choice: { icon: "◆", label: "選項" },
  block: { icon: "↳", label: "內容區塊" },
  if: { icon: "◇", label: "條件" },
  label: { icon: "⚑", label: "標籤" },
  bg: { icon: "🖼", label: "背景" },
  bgm: { icon: "🎵", label: "BGM" },
  show: { icon: "🧍", label: "立繪登場" },
  ending: { icon: "🏁", label: "結局" },
};

/**
 * 從指令陣列抽出結構地標。
 * @returns {Array<{index:number, kind:string, title:string, detail:string, inBlock:string|null}>}
 */
export function collectLandmarks(instructions) {
  const out = [];

  // 先算出每個索引落在哪個區塊裡，跳轉時才知道要不要先切分頁
  const blockOf = new Array(instructions.length).fill(null);
  instructions.forEach((ins, i) => {
    if (ins.type !== "block") return;
    const end = ins.endIndex ?? instructions.length;
    for (let j = i; j <= end && j < instructions.length; j++) blockOf[j] = ins.name;
  });

  instructions.forEach((ins, i) => {
    const inBlock = blockOf[i];
    const push = (kind, title, detail = "") =>
      out.push({ index: i, kind, title, detail, inBlock: kind === "block" ? null : inBlock });

    switch (ins.type) {
      case "choice": {
        const opts = ins.options || [];
        push("choice", `${opts.length} 個選項`,
          opts.map((o) => o.text || "（空白）").join(" ／ ").slice(0, 60));
        break;
      }
      case "block":
        push("block", ins.name || "（未命名）");
        break;
      case "if":
        push("if", explainCondition(ins.condition)
          .replace(/^當\s*/, "").replace(/\s*時執行。$/, ""));
        break;
      case "label":
        push("label", ins.name || "");
        break;
      case "ending":
        push("ending", ins.title || ins.id || "");
        break;
      case "directive": {
        const first = ins.args?.positional?.[0];
        if (ins.name === "bg" && first) push("bg", String(first));
        else if (ins.name === "bgm" && first) push("bgm", String(first));
        // 角色登場是實質的場面轉折（誰在台上變了），對話密集的場景常常只剩這個
        else if (ins.name === "show" && first) push("show", String(first));
        break;
      }
    }
  });

  return out;
}

/**
 * 開啟大綱面板。
 * @param {Array} landmarks collectLandmarks() 的結果
 * @param {object} opts
 * @param {number|null} opts.currentIndex 目前選取的指令（用來標「你在這」）
 * @returns {Promise<object|null>} 選中的地標，取消為 null
 */
export function openOutlinePalette(landmarks, { currentIndex = null } = {}) {
  return openModal("跳到…", (close) => {
    const box = document.createElement("div");
    box.className = "outline-palette";

    const search = document.createElement("input");
    search.className = "instr-field outline-search";
    search.placeholder = "輸入關鍵字篩選，↑↓ 選擇，Enter 跳過去";
    box.appendChild(search);

    const list = document.createElement("div");
    list.className = "outline-list";
    box.appendChild(list);

    let filtered = landmarks;
    let active = 0;

    // 預設停在「目前位置之後最近的一個地標」，開啟時就在手邊
    if (currentIndex != null) {
      const i = landmarks.findIndex((l) => l.index >= currentIndex);
      if (i >= 0) active = i;
    }

    const draw = () => {
      list.innerHTML = "";
      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "outline-empty";
        empty.textContent = landmarks.length === 0
          ? "這個場景沒有選項、區塊、條件或背景切換。"
          : "沒有符合的項目。";
        list.appendChild(empty);
        return;
      }
      filtered.forEach((lm, i) => {
        const k = KINDS[lm.kind] || { icon: "•", label: "" };
        const row = document.createElement("button");
        row.className = "outline-item" + (i === active ? " active" : "");
        row.dataset.kind = lm.kind;

        const num = document.createElement("span");
        num.className = "outline-num";
        num.textContent = lm.index + 1;

        const icon = document.createElement("span");
        icon.className = "outline-icon";
        icon.textContent = k.icon;

        const body = document.createElement("span");
        body.className = "outline-body";
        const t = document.createElement("span");
        t.className = "outline-title";
        t.textContent = lm.title;
        body.appendChild(t);
        if (lm.detail) {
          const d = document.createElement("span");
          d.className = "outline-detail";
          d.textContent = lm.detail;
          body.appendChild(d);
        }

        const tag = document.createElement("span");
        tag.className = "outline-tag";
        // 在區塊裡的地標要標出來，否則跳過去會莫名其妙換了分頁
        tag.textContent = lm.inBlock ? `↳ ${lm.inBlock}` : k.label;

        row.append(num, icon, body, tag);
        row.addEventListener("click", () => close(lm));
        list.appendChild(row);
      });
      list.querySelector(".outline-item.active")?.scrollIntoView({ block: "nearest" });
    };

    const move = (d) => {
      if (!filtered.length) return;
      active = (active + d + filtered.length) % filtered.length;
      draw();
    };

    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      filtered = !q ? landmarks : landmarks.filter((l) =>
        `${l.title} ${l.detail} ${l.inBlock || ""} ${KINDS[l.kind]?.label || ""}`
          .toLowerCase().includes(q));
      active = 0;
      draw();
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) close(filtered[active]); }
    });

    draw();
    // openModal 之後才進 DOM，聚焦要等一拍；這個環境 rAF 會被節流，用 setTimeout
    setTimeout(() => search.focus(), 0);
    return box;
  }, { wide: true });
}
