// ============================================
// ChoiceMenu.js
// 選項選單：顯示 & 取得玩家選擇
// ============================================

export class ChoiceMenu {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }

  show(options) {
    return new Promise((resolve) => {
      this.containerEl.innerHTML = "";
      options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.textContent = opt.text;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hide();
          resolve(idx);
        });
        this.containerEl.appendChild(btn);
      });
      this.containerEl.classList.remove("hidden");
    });
  }

  hide() {
    this.containerEl.classList.add("hidden");
    this.containerEl.innerHTML = "";
  }
}
