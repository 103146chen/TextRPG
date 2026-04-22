// ============================================
// FlagInspector.js
// 列出專案中所有 flag，顯示使用位置，支援全域改名
// ============================================

export class FlagInspector {
  constructor(containerEl, project, onJumpTo) {
    this.containerEl = containerEl;
    this.project = project;
    this.onJumpTo = onJumpTo;
    project.subscribe(() => this.render());
  }

  render() {
    this.containerEl.innerHTML = "";

    const flagMap = this.#collectFlags();

    const header = document.createElement("div");
    header.className = "panel-header";
    const count = Object.keys(flagMap).length;
    header.innerHTML = `
      <span>Flags</span>
      <span class="panel-count">${count}</span>
    `;
    this.containerEl.appendChild(header);

    if (count === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒使用任何 flag";
      this.containerEl.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "flag-list";

    // 排序：有警告的在前（被讀但沒設），然後按名稱
    const entries = Object.entries(flagMap).sort(([a, aInfo], [b, bInfo]) => {
      const aWarn = aInfo.reads.length > 0 && aInfo.sets.length === 0;
      const bWarn = bInfo.reads.length > 0 && bInfo.sets.length === 0;
      if (aWarn !== bWarn) return aWarn ? -1 : 1;
      return a.localeCompare(b);
    });

    for (const [name, info] of entries) {
      list.appendChild(this.#renderFlagItem(name, info));
    }
    this.containerEl.appendChild(list);
  }

  #renderFlagItem(name, info) {
    const el = document.createElement("div");
    el.className = "flag-item";

    const setCount = info.sets.length;
    const readCount = info.reads.length;
    const isOrphan = readCount > 0 && setCount === 0;
    const isUnused = setCount > 0 && readCount === 0;

    const header = document.createElement("div");
    header.className = "flag-header";
    if (isOrphan) header.classList.add("warn");
    header.innerHTML = `
      <span class="flag-name">${escapeHtml(name)}</span>
      <span class="flag-counts">
        <span class="flag-count-set" title="被設定的次數">✎ ${setCount}</span>
        <span class="flag-count-read" title="被讀取的次數">◉ ${readCount}</span>
      </span>
      <button class="flag-rename" title="重新命名">✎</button>
      <button class="flag-expand" title="展開">▾</button>
    `;
    el.appendChild(header);

    const body = document.createElement("div");
    body.className = "flag-body";
    body.style.display = "none";

    // 設定位置
    if (info.sets.length > 0) {
      const section = document.createElement("div");
      section.className = "flag-section";
      section.innerHTML = `<div class="flag-section-label">被設定於：</div>`;
      for (const loc of info.sets) {
        const row = document.createElement("div");
        row.className = "flag-ref";
        row.innerHTML = `
          <span class="flag-ref-scene">${escapeHtml(loc.sceneId)}</span>
          <span class="flag-ref-detail">${escapeHtml(loc.detail)}</span>
        `;
        row.addEventListener("click", () => this.onJumpTo?.(loc.sceneId, loc.index));
        section.appendChild(row);
      }
      body.appendChild(section);
    }

    // 讀取位置
    if (info.reads.length > 0) {
      const section = document.createElement("div");
      section.className = "flag-section";
      section.innerHTML = `<div class="flag-section-label">被讀取於：</div>`;
      for (const loc of info.reads) {
        const row = document.createElement("div");
        row.className = "flag-ref";
        row.innerHTML = `
          <span class="flag-ref-scene">${escapeHtml(loc.sceneId)}</span>
          <span class="flag-ref-detail">${escapeHtml(loc.detail)}</span>
        `;
        row.addEventListener("click", () => this.onJumpTo?.(loc.sceneId, loc.index));
        section.appendChild(row);
      }
      body.appendChild(section);
    }

    if (isOrphan) {
      const warn = document.createElement("div");
      warn.className = "flag-warning";
      warn.textContent = "⚠ 這個 flag 被讀取但從未設定（可能是拼字錯誤）";
      body.appendChild(warn);
    } else if (isUnused) {
      const info = document.createElement("div");
      info.className = "flag-info";
      info.textContent = "ⓘ 這個 flag 被設定但從未被條件使用";
      body.appendChild(info);
    }

    el.appendChild(body);

    // 展開/收起
    const expandBtn = header.querySelector(".flag-expand");
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const shown = body.style.display !== "none";
      body.style.display = shown ? "none" : "block";
      expandBtn.textContent = shown ? "▾" : "▴";
    });

    // 改名
    const renameBtn = header.querySelector(".flag-rename");
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.#renameFlag(name);
    });

    return el;
  }

  #renameFlag(oldName) {
    const newName = prompt(`將 flag "${oldName}" 重新命名為：`, oldName);
    if (!newName || newName === oldName) return;
    if (!/^[a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*$/.test(newName)) {
      alert("flag 名稱只能包含字母、數字、底線，且不能以數字開頭。");
      return;
    }

    // 掃過所有場景做更新
    let changed = 0;
    for (const sceneId of this.project.getAllSceneIds()) {
      const scene = this.project.getScene(sceneId);
      let sceneChanged = false;
      scene.instructions.forEach((ins, idx) => {
        if (ins.type === "set" && ins.key === oldName) {
          ins.key = newName;
          sceneChanged = true;
          changed++;
        }
        if ((ins.type === "if" || ins.type === "elif") && ins.condition) {
          const newCond = this.#replaceFlagInCondition(ins.condition, oldName, newName);
          if (newCond !== ins.condition) {
            ins.condition = newCond;
            sceneChanged = true;
            changed++;
          }
        }
        if (ins.type === "choice") {
          for (const opt of ins.options) {
            if (opt.set && oldName in opt.set) {
              opt.set[newName] = opt.set[oldName];
              delete opt.set[oldName];
              sceneChanged = true;
              changed++;
            }
          }
        }
      });
      if (sceneChanged) this.project.markDirty(sceneId);
    }

    if (changed > 0) {
      this.project.notify("flag-renamed", { oldName, newName, count: changed });
      this.render();
    }
  }

  #replaceFlagInCondition(expr, oldName, newName) {
    // 避免替換字串內容
    // 簡化：用 regex word boundary，但要跳過字串
    const parts = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (ch === '"' || ch === "'") {
        // 跳過字串
        let end = i + 1;
        while (end < expr.length && expr[end] !== ch) {
          if (expr[end] === "\\") end++;
          end++;
        }
        parts.push(expr.slice(i, end + 1));
        i = end + 1;
      } else {
        // 找下一個字串起點
        let end = i;
        while (end < expr.length && expr[end] !== '"' && expr[end] !== "'") end++;
        let segment = expr.slice(i, end);
        segment = segment.replace(new RegExp(`\\b${oldName}\\b`, "g"), newName);
        parts.push(segment);
        i = end;
      }
    }
    return parts.join("");
  }

  // ============ 蒐集 flag ============

  #collectFlags() {
    const result = {};  // name -> { sets: [...], reads: [...] }
    const ensure = (name) => {
      if (!result[name]) result[name] = { sets: [], reads: [] };
      return result[name];
    };

    for (const sceneId of this.project.getAllSceneIds()) {
      const scene = this.project.getScene(sceneId);
      scene.instructions.forEach((ins, idx) => {
        if (ins.type === "set") {
          ensure(ins.key).sets.push({
            sceneId, index: idx,
            detail: `${ins.key} ${ins.op} ${this.#formatValue(ins.value)}`,
          });
        }
        if (ins.type === "if" || ins.type === "elif") {
          for (const flag of this.#extractFlags(ins.condition)) {
            ensure(flag).reads.push({
              sceneId, index: idx,
              detail: `${ins.type}: ${ins.condition}`,
            });
          }
        }
        if (ins.type === "choice") {
          for (const opt of ins.options) {
            for (const [k, v] of Object.entries(opt.set || {})) {
              ensure(k).sets.push({
                sceneId, index: idx,
                detail: `選項「${opt.text}」→ ${k} = ${this.#formatValue(v)}`,
              });
            }
          }
        }
      });
    }
    return result;
  }

  #extractFlags(expr) {
    if (!expr) return [];
    const withoutStrings = expr
      .replace(/"([^"\\]|\\.)*"/g, "")
      .replace(/'([^'\\]|\\.)*'/g, "");
    const flags = [];
    const reserved = new Set(["true", "false", "null"]);
    const regex = /([a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*)/g;
    let m;
    while ((m = regex.exec(withoutStrings)) !== null) {
      if (!reserved.has(m[1])) flags.push(m[1]);
    }
    return [...new Set(flags)];
  }

  #formatValue(v) {
    if (typeof v === "string") return `"${v}"`;
    return String(v);
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
