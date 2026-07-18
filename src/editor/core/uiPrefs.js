// ============================================
// uiPrefs.js
// 編輯器人體工學偏好（純前端，存 localStorage，與專案無關）：
//  - 劇本頁左右欄可拖曳調寬（中間欄自動伸縮）
//  - 介面縮放（整體 zoom）
// ============================================

const LS = {
  wStructure: "editor.w.structure",
  wPreview: "editor.w.preview",
  zoom: "editor.zoom",
};

export function initUiPrefs() {
  const app = document.getElementById("editor-app");
  if (!app) return;

  // ---- 還原欄寬 ----
  const savedS = localStorage.getItem(LS.wStructure);
  const savedP = localStorage.getItem(LS.wPreview);
  if (savedS) app.style.setProperty("--w-structure", savedS);
  if (savedP) app.style.setProperty("--w-preview", savedP);

  // ---- 欄位拖曳 ----
  for (const sp of document.querySelectorAll(".col-splitter")) {
    sp.addEventListener("mousedown", (e) => startDrag(e, sp, app));
  }

  // ---- 介面縮放 ----
  initZoom(app);
}

function startDrag(e, sp, app) {
  e.preventDefault();
  const which = sp.dataset.resize;                 // "structure" | "preview"
  const varName = which === "structure" ? "--w-structure" : "--w-preview";
  const fallback = which === "structure" ? 260 : 420;
  const startX = e.clientX;
  const startW = parseInt(getComputedStyle(app).getPropertyValue(varName)) || fallback;
  const zoom = parseFloat(app.style.zoom) || 1;

  sp.classList.add("dragging");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  const onMove = (ev) => {
    // preview 在右側，往右拖是「變窄」；縮放時把位移換算回未縮放座標
    let delta = (ev.clientX - startX) / zoom;
    if (which === "preview") delta = -delta;
    const w = Math.max(160, Math.min(680, Math.round(startW + delta)));
    app.style.setProperty(varName, w + "px");
  };
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    sp.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    const key = which === "structure" ? LS.wStructure : LS.wPreview;
    localStorage.setItem(key, getComputedStyle(app).getPropertyValue(varName).trim());
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function initZoom(app) {
  const slider = document.getElementById("pref-zoom");
  const valEl = document.getElementById("pref-zoom-val");
  const resetBtn = document.getElementById("pref-zoom-reset");
  if (!slider) return;

  const apply = (z) => {
    app.style.zoom = String(z);
    if (valEl) valEl.textContent = Math.round(z * 100) + "%";
  };

  const saved = parseFloat(localStorage.getItem(LS.zoom)) || 1;
  slider.value = String(saved);
  apply(saved);

  slider.addEventListener("input", () => apply(parseFloat(slider.value)));
  slider.addEventListener("change", () => localStorage.setItem(LS.zoom, slider.value));
  resetBtn?.addEventListener("click", () => {
    slider.value = "1";
    apply(1);
    localStorage.setItem(LS.zoom, "1");
  });
}
