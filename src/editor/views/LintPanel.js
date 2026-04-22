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
    const issues = this.lastIssues;
    const errs = issues.filter(i => i.level === "error").length;
    const warns = issues.filter(i => i.level === "warning").length;
    const infos = issues.filter(i => i.level === "info").length;

    this.containerEl.innerHTML = "";

    const header = document.createElement("div");
    header.className = "lint-header";
    header.innerHTML = `
      <span class="lint-count err" title="錯誤">✕ ${errs}</span>
      <span class="lint-count warn" title="警告">⚠ ${warns}</span>
      <span class="lint-count info" title="提示">ⓘ ${infos}</span>
      <button class="lint-toggle" title="展開/收起">▲</button>
    `;
    this.containerEl.appendChild(header);

    const list = document.createElement("div");
    list.className = "lint-list";

    if (issues.length === 0) {
      const empty = document.createElement("div");
      empty.className = "lint-empty";
      empty.innerHTML = "✓ 劇本沒有問題";
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
    header.querySelector(".lint-toggle").addEventListener("click", () => {
      const isHidden = list.style.display === "none";
      list.style.display = isHidden ? "" : "none";
      header.querySelector(".lint-toggle").textContent = isHidden ? "▲" : "▼";
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
