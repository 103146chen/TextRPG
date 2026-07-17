// ============================================
// toast.js
// 短暫提示訊息（右下角淡入淡出）。共用於編輯器各處。
// kind: "info" | "success" | "error"
// ============================================

export function toast(message, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
