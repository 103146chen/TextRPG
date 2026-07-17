// ============================================
// dialog.js
// 輕量對話框：取代原生 prompt() / alert()。
// - 深色主題，與編輯器一致
// - Enter 確認、Esc／點背景 取消
// - 行內驗證：validate 回傳錯誤字串時不關閉、保留輸入、顯示紅字
//   （解掉原生 prompt「重名彈 alert 後輸入消失」的痛點）
// ============================================

/**
 * 詢問一段文字輸入。
 * @param {object} o
 * @param {string} [o.title]        標題
 * @param {string} [o.label]        輸入框上方說明
 * @param {string} [o.value]        預設值
 * @param {string} [o.placeholder]  佔位提示
 * @param {string} [o.confirmText]  確認鈕文字
 * @param {string} [o.cancelText]   取消鈕文字
 * @param {(v:string)=>(string|null|undefined)} [o.validate]
 *        回傳非空字串＝驗證失敗（顯示為錯誤、對話框不關閉）
 * @returns {Promise<string|null>} 確認回傳字串；取消回傳 null
 */
export function promptDialog({
  title = "",
  label = "",
  value = "",
  placeholder = "",
  confirmText = "確定",
  cancelText = "取消",
  validate = null,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "e-dialog-overlay";

    const box = document.createElement("div");
    box.className = "e-dialog";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");

    if (title) {
      const t = document.createElement("div");
      t.className = "e-dialog-title";
      t.textContent = title;
      box.appendChild(t);
    }
    if (label) {
      const l = document.createElement("label");
      l.className = "e-dialog-label";
      l.textContent = label;
      box.appendChild(l);
    }

    const input = document.createElement("input");
    input.className = "e-dialog-input";
    input.type = "text";
    input.value = value;
    input.placeholder = placeholder;
    box.appendChild(input);

    const err = document.createElement("div");
    err.className = "e-dialog-error";
    box.appendChild(err);

    const actions = document.createElement("div");
    actions.className = "e-dialog-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "tb-btn e-dialog-cancel";
    cancelBtn.textContent = cancelText;
    const okBtn = document.createElement("button");
    okBtn.className = "tb-btn primary e-dialog-ok";
    okBtn.textContent = confirmText;
    actions.append(cancelBtn, okBtn);
    box.appendChild(actions);

    overlay.appendChild(box);

    function close(result) {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(result);
    }
    function submit() {
      const v = input.value;
      if (validate) {
        const msg = validate(v);
        if (msg) { err.textContent = msg; input.focus(); input.select(); return; }
      }
      close(v);
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(null); }
      else if (e.key === "Enter") { e.preventDefault(); submit(); }
    }

    okBtn.addEventListener("click", submit);
    cancelBtn.addEventListener("click", () => close(null));
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(null); });
    input.addEventListener("input", () => { if (err.textContent) err.textContent = ""; });
    document.addEventListener("keydown", onKey, true);

    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}
