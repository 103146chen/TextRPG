// ============================================
// formFields.js
// 管理面板共用的表單小工具。
// 原為 StoryManager（資料庫 Hub）的私有方法；Hub 拆分至各主分頁後，
// 抽成共用模組供 CharacterManager / FlagManager / EndingManager /
// ProjectSettings 使用，避免四份複製。
// ============================================

/** 標籤 + 輸入元件 的一列（.sm-field 樣式） */
export function field(labelText, inputEl) {
  const wrap = document.createElement("div");
  wrap.className = "sm-field";
  const lab = document.createElement("label");
  lab.textContent = labelText;
  wrap.appendChild(lab);
  wrap.appendChild(inputEl);
  return wrap;
}

/** 小型說明文字 */
export function subLabel(text) {
  const span = document.createElement("span");
  span.className = "sm-sub-label";
  span.textContent = text;
  return span;
}

/** 單行文字輸入（change 時回呼；可唯讀、可附說明） */
export function textInput({ value, placeholder = "", onChange, readonly = false, help }) {
  const wrapper = document.createElement("span");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.flex = "1";

  const input = document.createElement("input");
  input.type = "text";
  input.value = value ?? "";
  input.placeholder = placeholder;
  if (readonly) { input.readOnly = true; input.style.opacity = "0.6"; }
  if (onChange) input.addEventListener("change", () => onChange(input.value));
  wrapper.appendChild(input);

  if (help) {
    const h = document.createElement("span");
    h.style.fontSize = "11px";
    h.style.color = "var(--e-text-faded)";
    h.style.marginTop = "2px";
    h.textContent = help;
    wrapper.appendChild(h);
  }
  return wrapper;
}

/** 帶 datalist 建議清單的輸入框（可自由輸入，也可從既有檔名挑選） */
export function datalistInput({ value, options, placeholder, onChange }) {
  const wrapper = document.createElement("span");
  wrapper.style.display = "contents";
  const input = document.createElement("input");
  input.value = value || "";
  input.placeholder = placeholder;
  const dl = document.createElement("datalist");
  const dlId = `dl-${Math.random().toString(36).slice(2, 9)}`;
  dl.id = dlId;
  input.setAttribute("list", dlId);
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    dl.appendChild(o);
  }
  if (onChange) input.addEventListener("change", () => onChange(input.value));
  wrapper.appendChild(input);
  wrapper.appendChild(dl);
  return wrapper;
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
