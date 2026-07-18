// ============================================
// speakerColor.js
// 說話者顏色（純編輯器用途，方便寫作時一眼分辨誰在說話）。
// 取自 story.json 的 characters[名字].color；未設定則依名字雜湊挑一個
// 穩定的預設色（同一角色永遠同色），引擎不讀這個欄位。
// ============================================

const PALETTE = [
  "#5b8ff9", "#61ddaa", "#f6bd16", "#7262fd", "#78d3f8",
  "#f08bb4", "#e8684a", "#6dc8ec", "#9270ca", "#ff9d4d",
];

/** 依名字產生穩定的預設色 */
export function defaultSpeakerColor(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** 角色設定色優先，其次為預設色；無名字（旁白）回傳空字串 */
export function speakerColor(project, name) {
  if (!name) return "";
  const c = project?.storyMeta?.characters?.[name]?.color;
  return c || defaultSpeakerColor(name);
}
