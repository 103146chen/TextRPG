// ============================================
// LintPanel.js
// 顯示 linter 結果，可點擊跳到問題位置
// ============================================

import { Linter } from "../core/Linter.js";

export class LintPanel {
  constructor(containerEl, project, onJumpTo) {
    this.containerEl = containerEl;
    this.project = project;
    this.onJumpTo = onJumpTo;
    this.lastIssues = [];
    this.debounceTimer = null;
    this.filter = "all"; // "all" | "error" | "warning" | "info"

    project.subscribe(() => this.refresh());
  }

  refresh() {
    // 防抖動，避免每次改動都重算
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.#doAnalyze(), 200);
  }

  #doAnalyze() {
    try {
      this.lastIssues = Linter.analyze(this.project);
    } catch (e) {
      console.error(e);
      this.lastIssues = [{ level: "error", sceneId: null, index: null, message: `Linter 自身錯誤: ${e.message}` }];
    }
    this.render();
  }

  render() {
    const allIssues = this.lastIssues;
    const errs  = allIssues.filter(i => i.level === "error").length;
    const warns = allIssues.filter(i => i.level === "warning").length;
    const infos = allIssues.filter(i => i.level === "info").length;

    // 依目前篩選條件過濾
    const issues = this.filter === "all"
      ? allIssues
      : allIssues.filter(i => i.level === this.filter);

    this.containerEl.innerHTML = "";

    // --- 標頭 ---
    const header = document.createElement("div");
    header.className = "lint-header";

    const makeCount = (level, icon, count) => {
      const btn = document.createElement("button");
      btn.className = `lint-count ${level}${this.filter === level ? " active" : ""}`;
      btn.title = { error: "只顯示錯誤", warning: "只顯示警告", info: "只顯示提示" }[level];
      btn.textContent = `${icon} ${count}`;
      btn.addEventListener("click", () => {
        this.filter = this.filter === level ? "all" : level;
        this.render();
      });
      return btn;
    };

    header.appendChild(makeCount("error",   "✕", errs));
    header.appendChild(makeCount("warning", "⚠", warns));
    header.appendChild(makeCount("info",    "ⓘ", infos));

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "lint-toggle";
    toggleBtn.title = "展開/收起";
    toggleBtn.textContent = "▲";
    header.appendChild(toggleBtn);

    this.containerEl.appendChild(header);

    // --- 清單 ---
    const list = document.createElement("div");
    list.className = "lint-list";

    if (allIssues.length === 0) {
      const empty = document.createElement("div");
      empty.className = "lint-empty";
      empty.innerHTML = "✓ 劇本沒有問題";
      list.appendChild(empty);
    } else if (issues.length === 0) {
      const empty = document.createElement("div");
      empty.className = "lint-empty";
      empty.innerHTML = `目前篩選（${this.filter}）無符合項目`;
      list.appendChild(empty);
    } else {
      // 依場景分組
      const byScene = new Map();
      for (const iss of issues) {
        const key = iss.sceneId || "(全域)";
        if (!byScene.has(key)) byScene.set(key, []);
        byScene.get(key).push(iss);
      }

      for (const [sceneId, items] of byScene) {
        const group = document.createElement("div");
        group.className = "lint-group";

        const groupHeader = document.createElement("div");
        groupHeader.className = "lint-group-header";
        groupHeader.textContent = sceneId;
        group.appendChild(groupHeader);

        for (const iss of items) {
          const row = document.createElement("div");
          row.className = `lint-item ${iss.level}`;
          const icon = { error: "✕", warning: "⚠", info: "ⓘ" }[iss.level];
          row.innerHTML = `
            <span class="lint-icon">${icon}</span>
            <span class="lint-msg">${escapeHtml(iss.message)}</span>
            ${iss.index !== null ? `<span class="lint-loc">#${iss.index}</span>` : ""}
          `;
          if (iss.sceneId && this.onJumpTo) {
            row.style.cursor = "pointer";
            row.addEventListener("click", () => this.onJumpTo(iss.sceneId, iss.index));
          }
          group.appendChild(row);
        }
        list.appendChild(group);
      }
    }
    this.containerEl.appendChild(list);

    // 收合按鈕
    toggleBtn.addEventListener("click", () => {
      const isHidden = list.style.display === "none";
      list.style.display = isHidden ? "" : "none";
      toggleBtn.textContent = isHidden ? "▲" : "▼";
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
