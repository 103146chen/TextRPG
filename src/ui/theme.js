// ============================================
// theme.js
// 遊戲個性化主題：story.json 的 theme 區塊 → 遊戲端 CSS 變數。
// 契約即 main.css 既有的一組 :root 變數（--font-body / --textbox-* / --gold…），
// 未設定的欄位一律沿用 main.css 預設。
//
// 三方共用：
//  - 遊戲（src/main.js）套用到 document.documentElement
//  - 預覽（preview.js）套用到 iframe 的 :root
//  - 編輯器個性化頁的即時範例（套用到 sample 容器）
// ============================================

// 可選字體（值即 CSS font-family 堆疊）。皆為 index/preview 已載入的字體 + 系統後備。
export const FONT_OPTIONS = [
  ["serif-tc", '"Noto Serif TC", "Shippori Mincho", serif', "思源宋體（預設）"],
  ["klee", '"Klee One", "Noto Serif TC", cursive', "手寫風 Klee"],
  ["mincho", '"Shippori Mincho", "Noto Serif TC", serif', "しっぽり明朝"],
  ["sans-tc", '"Noto Sans TC", system-ui, sans-serif', "黑體"],
  ["system", "system-ui, -apple-system, sans-serif", "系統預設"],
];

const FONT_STACK = Object.fromEntries(FONT_OPTIONS.map(([k, stack]) => [k, stack]));

// 欄位契約：editor 用來生成控制項，applyTheme 用來寫變數。
// type: font | color | opacity
export const THEME_FIELDS = [
  { key: "font", label: "字體", type: "font", cssVar: "--font-body" },
  { key: "textboxText", label: "文字框文字色", type: "color", cssVar: "--textbox-text", default: "#f0e6d2" },
  { key: "textboxBgColor", label: "文字框底色", type: "color", cssVar: null, default: "#14100c" },
  { key: "textboxBgOpacity", label: "文字框透明度", type: "opacity", cssVar: null, default: 0.82 },
  { key: "textboxBorder", label: "文字框邊框色", type: "color", cssVar: "--textbox-border", default: "#c9a45e" },
  { key: "speakerBg", label: "名條底色", type: "color", cssVar: "--speaker-bg", default: "#7a2e44" },
  { key: "accent", label: "強調色（金）", type: "color", cssVar: "--gold", default: "#c9a45e" },
];

/** #rrggbb + 透明度 → rgba(...) 字串 */
export function hexToRgba(hex, alpha = 1) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || "").trim());
  if (!m) return hex || "";
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 把 theme 套到某元素的 inline CSS 變數（未設定的欄位不動，沿用 main.css 預設）。
 * @param {object} theme story.json 的 theme 區塊
 * @param {HTMLElement} [el] 目標（預設整份文件根）
 */
export function applyTheme(theme, el = document.documentElement) {
  if (!el) return;
  const t = theme || {};

  // 直接對應的欄位
  for (const f of THEME_FIELDS) {
    if (!f.cssVar) continue;
    if (f.type === "font") {
      if (t.font) el.style.setProperty(f.cssVar, FONT_STACK[t.font] || t.font);
    } else if (t[f.key] != null && t[f.key] !== "") {
      el.style.setProperty(f.cssVar, t[f.key]);
    }
  }

  // 複合：文字框底色 = 顏色 + 透明度
  if (t.textboxBgColor || t.textboxBgOpacity != null) {
    const color = t.textboxBgColor || "#14100c";
    const op = t.textboxBgOpacity != null ? t.textboxBgOpacity : 0.82;
    el.style.setProperty("--textbox-bg", hexToRgba(color, op));
  }
}
