// ============================================
// anchors.js
// 錨點的「單一真相來源」：引擎（CharacterLayer）與編輯器（PositionEditor）共用。
//
// 錨點 = 圖片自身的哪一點對齊到座標。
// 作法：transform-origin 設在該點（讓 scale 以它為中心），
//       translate 把該點移到座標上。
//
// 刻意共用同一份定義，而不是兩邊各寫一份再用測試比對 ——
// 若各寫一份，編輯器格線裡的示意框就可能與遊戲實際渲染位置漂移。
// ============================================

/**
 * t = transform 的 translate 值（CSS）
 * o = transform-origin
 * f = [x, y] 位移比例（0=左/上、0.5=中、1=右/下），供編輯器換算示意框
 */
export const ANCHORS = {
  left_top:      { t: "0, 0",         o: "left top",      f: [0, 0],     label: "左上" },
  center_top:    { t: "-50%, 0",      o: "center top",    f: [0.5, 0],   label: "上中" },
  right_top:     { t: "-100%, 0",     o: "right top",     f: [1, 0],     label: "右上" },
  left_center:   { t: "0, -50%",      o: "left center",   f: [0, 0.5],   label: "左中" },
  center:        { t: "-50%, -50%",   o: "center center", f: [0.5, 0.5], label: "正中" },
  right_center:  { t: "-100%, -50%",  o: "right center",  f: [1, 0.5],   label: "右中" },
  left_bottom:   { t: "0, -100%",     o: "left bottom",   f: [0, 1],     label: "左下" },
  center_bottom: { t: "-50%, -100%",  o: "center bottom", f: [0.5, 1],   label: "底中" },
  right_bottom:  { t: "-100%, -100%", o: "right bottom",  f: [1, 1],     label: "右下" },
};

export const DEFAULT_ANCHOR = "center_bottom";

/** 定位模式下立繪的基準高度（佔畫面 %），再乘上 scale */
export const DEFAULT_HEIGHT_PCT = 80;

/** 九宮格順序（給編輯器排 UI 用） */
export const ANCHOR_ORDER = [
  "left_top", "center_top", "right_top",
  "left_center", "center", "right_center",
  "left_bottom", "center_bottom", "right_bottom",
];

export function anchorOf(name) {
  return ANCHORS[name] || ANCHORS[DEFAULT_ANCHOR];
}
