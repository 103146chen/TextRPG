// ============================================
// main.js (編輯器)
// 組裝整個編輯器
// ============================================

import { ProjectFileSystem } from "./core/FileSystem.js";
import { StoryProject } from "./core/StoryProject.js";
import { SceneEditor } from "./views/SceneEditor.js";
import { PreviewPanel } from "./views/PreviewPanel.js";
import { GraphView } from "./views/GraphView.js";
import { LintPanel } from "./views/LintPanel.js";
import { FlagInspector } from "./views/FlagInspector.js";
import { CharacterManager } from "./views/CharacterManager.js";
import { FlagManager } from "./views/FlagManager.js";
import { EndingManager } from "./views/EndingManager.js";
import { ChapterManager } from "./views/ChapterManager.js";
import { ProjectSettings } from "./views/ProjectSettings.js";
import { ThemeEditor } from "./views/ThemeEditor.js";
import { AssetPanel } from "./views/AssetPanel.js";
import { AssetOverview } from "./views/AssetOverview.js";
import { PositionEditor } from "./views/PositionEditor.js";
import { MemoryBackend } from "./core/MemoryBackend.js";
import { exportProjectZip } from "./core/projectZip.js";
import { SceneParser } from "../engine/SceneParser.js";
import { MarkdownWriter } from "./core/MarkdownWriter.js";
import { SceneJson } from "./core/SceneJson.js";
import { createAutosave } from "./core/autosave.js";
import { initUiPrefs } from "./core/uiPrefs.js";
import { clearAssetUrls } from "./core/assetUrl.js";
import { promptDialog, confirmDialog } from "./widgets/dialog.js";
import { toast } from "./widgets/toast.js";
import { renderDirectiveForm, DIRECTIVE_SCHEMAS } from "./widgets/directiveFields.js";

const $ = s => document.querySelector(s);

// ==================== 選擇儲存後端 ====================
// 支援 File System Access API（Chrome/Edge/Opera）→ 直接讀寫本機資料夾；
// 否則（Firefox/Safari）→ 記憶體後端，靠 ZIP 匯入匯出 + IndexedDB 持久化。
const usingMemory = !ProjectFileSystem.isSupported();

// ==================== 初始化 ====================

const fs = usingMemory ? new MemoryBackend() : new ProjectFileSystem();
const project = new StoryProject(fs);
const previewPanel = new PreviewPanel(project, { container: $("#preview-host") });
const sceneEditor = new SceneEditor(
  $("#main-content"),
  project,
  (sceneId, index) => previewPanel.play(sceneId, index),          // ▶ 從這裡試玩：實際播放
  (tab) => handleManage(tab),
  (sceneId, index) => {                                            // 點選指令：靜態預覽跟隨
    previewPanel.scrub(sceneId, index);
    renderInspector(sceneId, index);
  }
);
const graphView = new GraphView($("#graph-content"), project, (sceneId) => {
  currentSceneId = sceneId;
  setPage("script");
});
const lintPanel = new LintPanel($("#lint-panel"), project, (sceneId, index) => {
  currentSceneId = sceneId;
  setPage("script");
  setTimeout(() => {
    if (index !== null) {
      const row = document.querySelector(`.instr-row[data-index="${index}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.style.outline = "2px solid var(--e-red)";
        setTimeout(() => { row.style.outline = ""; }, 2000);
      }
    }
  }, 100);
});

// 跳到劇本中的某條指令並高亮：沿用全域搜尋那支 jumpToInstruction（宣告會提升）
const flagInspector = new FlagInspector($("#flag-panel"), project, jumpToInstruction);

// 原「資料庫 Hub」拆分後的常駐視圖（S4.5）：
// 角色→資產頁、變數/結局→敘事地圖、基本資訊→設定頁
const characterManager = new CharacterManager($("#character-manager"), project);
new FlagManager($("#var-manage"), project, jumpToInstruction);
const endingManager = new EndingManager($("#ending-manage"), project);
const chapterManager = new ChapterManager($("#chapter-manage"), project, (id) => {
  currentSceneId = id;
  setPage("script");
});
new ProjectSettings($("#project-settings"), project);
new ThemeEditor($("#theme-editor"), project);
initUiPrefs();
// 資產頁分類入口（優化①）：總覽 + 每類一個過濾後的 AssetPanel
new AssetOverview($("#asset-overview"), project, { onNavigate: (view) => setAssetView(view) });
new AssetPanel($("#asset-files-characters"), project, { kinds: ["characters"] });
for (const kind of ["backgrounds", "bgm", "se", "voice", "video"]) {
  new AssetPanel($(`#asset-kind-${kind}`), project, { kinds: [kind] });
}
const positionEditor = new PositionEditor($("#position-editor"), project, {
  // 改完位置立刻在劇本頁的預覽看到（若目前選著某條指令）
  onChange: () => { if (currentSceneId != null) previewPanel.scrub(currentSceneId, sceneEditor.selectedIndex ?? 0); },
});

let currentSceneId = null;
let currentPage = "script";   // script | assets | map | theme | publish | settings
let sceneFilter = "";
let viewMode = "cards";       // cards | md | json

function setPage(page) {
  currentPage = page;
  document.querySelectorAll(".main-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.page === page));
  document.querySelectorAll(".page").forEach((p) =>
    p.classList.toggle("active", p.dataset.page === page));

  if (page === "map") setMapView(currentMapView);
  else if (page === "script") renderEvents();
}

// ==================== 檢視切換（卡片 / Markdown / JSON）====================

async function setViewMode(mode) {
  // 離開原始碼檢視前，若有未套用的編輯就先確認
  if ((viewMode === "md" || viewMode === "json") && mode !== viewMode && isSourceDirty()) {
    if (!(await confirmDialog({
      title: "捨棄未套用的變更？",
      message: "原始碼有未套用的變更，切換檢視後會捨棄。",
      confirmText: "捨棄並切換", danger: true,
    }))) return;
  }
  viewMode = mode;
  document.querySelectorAll(".view-mode").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode));
  renderEvents();
}

function renderEvents() {
  const cards = mode0() === "cards";
  $("#main-content").style.display = cards ? "flex" : "none";
  $("#source-view").style.display = cards ? "none" : "flex";
  $("#events-scene-name").textContent = currentSceneId
    ? (project.getScene(currentSceneId)?.meta.title || currentSceneId)
    : "—";

  if (cards) {
    sceneEditor.openScene(currentSceneId);
  } else {
    fillSource();
  }
}

function mode0() { return viewMode; }

function serializeCurrent() {
  const sc = currentSceneId && project.getScene(currentSceneId);
  if (!sc) return "";
  const data = { meta: sc.meta, instructions: sc.instructions };
  return viewMode === "json"
    ? SceneJson.stringify(data)
    : MarkdownWriter.write(data, { characters: project.storyMeta?.characters || null,
        narrationPrefix: project.storyMeta?.narrationPrefix || "always" });
}

function fillSource() {
  const text = serializeCurrent();
  $("#source-text").value = text;
  $("#source-text").dataset.original = text;
  $("#source-text").disabled = !currentSceneId;
  setSourceStatus(currentSceneId ? "" : "未選擇場景", "");
}

function isSourceDirty() {
  const ta = $("#source-text");
  return ta.dataset.original !== undefined && ta.value !== ta.dataset.original;
}

function setSourceStatus(msg, kind = "") {
  const el = $("#source-status");
  el.textContent = msg;
  el.className = `source-status ${kind}`;
}

function applySource() {
  if (!currentSceneId) return;
  const text = $("#source-text").value;
  let data;
  try {
    data = viewMode === "json"
      ? SceneJson.parse(text)
      : SceneParser.parse(text, { characters: project.storyMeta?.characters || null });
  } catch (err) {
    setSourceStatus(`解析失敗：${err.message}`, "err");
    return;
  }
  project.replaceScene(currentSceneId, data);
  $("#source-text").dataset.original = $("#source-text").value;
  setSourceStatus("已套用", "ok");
  setTimeout(() => setSourceStatus("", ""), 2000);
}

// ==================== 工具列 ====================

$("#btn-open").addEventListener("click", async () => {
  try {
    const name = await fs.openProject();
    // 縮圖快取以檔名為鍵，換專案後同名檔會拿到舊圖，必須先清掉
    clearAssetUrls();
    await project.loadAll();
    toast(`已開啟專案：${name}`, "success");
    renderAll();
  } catch (err) {
    if (err.name !== "AbortError") {
      toast(`開啟失敗：${err.message}`, "error");
      console.error(err);
    }
  }
});

$("#btn-new").addEventListener("click", async () => {
  const storyId = await promptDialog({
    title: "新專案",
    label: "專案 ID（資料夾中的故事識別）",
    value: "new_story",
    placeholder: "例: my_story",
    validate: (v) => !v.trim() ? "請輸入專案 ID" : null,
  });
  if (storyId === null) return;
  const title = await promptDialog({
    title: "新專案",
    label: "故事標題",
    value: "新故事",
  });
  if (title === null) return;

  try {
    await fs.createNewProject({
      id: storyId,
      title,
      start: "01_start",
      characters: {},
      endings: [],
    });
    await project.loadAll();
    // 建立第一個場景
    project.createScene("01_start", { title: "開場" });
    await project.saveAll();
    toast(`已建立新專案：${fs.projectName}`, "success");
    renderAll();
  } catch (err) {
    if (err.name !== "AbortError") {
      toast(`建立失敗：${err.message}`, "error");
      console.error(err);
    }
  }
});

$("#btn-save").addEventListener("click", async () => {
  if (!fs.rootHandle) {
    toast("尚未開啟專案", "error");
    return;
  }
  try {
    await project.saveAll();
    toast("已儲存所有變更", "success");
    renderSidebar();
    updateToolbar();
  } catch (err) {
    toast(`儲存失敗：${err.message}`, "error");
    console.error(err);
  }
});

$("#btn-export-zip").addEventListener("click", async () => {
  if (!fs.rootHandle) { toast("尚未開啟專案", "error"); return; }
  try {
    const blob = await exportProjectZip(fs);
    const base = (project.storyMeta?.id || fs.projectName || "project").replace(/[^\w一-鿿-]+/g, "_");
    downloadBlob(blob, `${base}.zip`);
    toast("已匯出 ZIP", "success");
  } catch (err) {
    toast(`匯出失敗：${err.message}`, "error");
    console.error(err);
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("#btn-undo").addEventListener("click", () => {
  if (project.undo()) {
    renderAll();
    toast("已復原", "info");
  }
});

$("#btn-redo").addEventListener("click", () => {
  if (project.redo()) {
    renderAll();
    toast("已重做", "info");
  }
});

$("#btn-new-scene").addEventListener("click", async () => {
  if (!fs.rootHandle) {
    toast("請先開啟專案", "error");
    return;
  }
  const sceneId = await promptDialog({
    title: "新增場景",
    label: "新場景的 ID",
    placeholder: "例: 02_相遇",
    validate: (v) => {
      if (!v.trim()) return "請輸入場景 ID";
      if (project.getAllSceneIds().includes(v.trim())) return "場景 ID 已存在";
      return null;
    },
  });
  if (sceneId === null) return;
  try {
    project.createScene(sceneId, { title: sceneId });
    currentSceneId = sceneId;
    renderAll();
  } catch (err) {
    toast(err.message, "error");
  }
});

$("#btn-delete-scene").addEventListener("click", async () => {
  if (!currentSceneId) return;
  if (!(await confirmDialog({
    title: `刪除場景「${currentSceneId}」？`,
    message: "場景檔案會被刪除；若刪錯可用復原（Ctrl+Z）救回，存檔後生效。",
    confirmText: "刪除場景", danger: true,
  }))) return;
  try {
    await project.deleteScene(currentSceneId);
    currentSceneId = project.getAllSceneIds()[0] || null;
    sceneEditor.openScene(currentSceneId);
    renderAll();
    toast("已刪除場景", "info");
  } catch (err) {
    toast(`刪除失敗：${err.message}`, "error");
  }
});

// 「＋ 新增…」的統一入口：章節就地新增，其餘跳到對應的主分頁
// （資料庫 Hub 已拆分：characters→資產頁「角色」、flags→敘事地圖、assets→資產頁）
async function handleManage(tab) {
  if (tab === "chapters") {
    if (!project.storyMeta) { toast("請先開啟專案", "error"); return; }
    const title = await promptDialog({
      title: "新增章節",
      label: "章節名稱",
      placeholder: "例：第一章 · 相遇",
      validate: (v) => {
        if (!v.trim()) return "請輸入章節名稱";
        if (project.getChapters().some((c) => c.id === v.trim())) return "章節已存在";
        return null;
      },
    });
    if (title === null) return;
    const id = title.trim();
    project.upsertChapter({ id, title: id, scenes: [] });
    toast(`已新增章節：${id}`, "success");
    return;
  }
  if (!project.storyMeta) { toast("請先開啟專案", "error"); return; }
  if (tab === "flags") { setPage("map"); setMapView("flags"); return; }
  if (tab === "endings") { setPage("map"); setMapView("endings"); return; }
  // 劇本的結局卡片「到敘事地圖編輯」：跳過去並選中該結局
  if (tab.startsWith("ending:")) {
    setPage("map"); setMapView("endings");
    endingManager.selectById(tab.slice(7));
    return;
  }
  if (tab === "characters") { setPage("assets"); setAssetView("characters"); return; }
  if (tab.startsWith("asset-")) { setPage("assets"); setAssetView(tab.slice(6)); return; }
  if (tab === "assets") { setPage("assets"); setAssetView("overview"); return; }
}

// 頂部主分頁
document.querySelectorAll(".main-tab").forEach((tab) => {
  tab.addEventListener("click", () => setPage(tab.dataset.page));
});

// 檢視切換（卡片 / Markdown / JSON）
document.querySelectorAll(".view-mode").forEach((b) => {
  b.addEventListener("click", () => setViewMode(b.dataset.mode));
});
$("#btn-source-apply").addEventListener("click", applySource);
$("#btn-source-revert").addEventListener("click", () => {
  fillSource();
  setSourceStatus("已還原為目前內容", "");
});
$("#source-text").addEventListener("input", () => {
  setSourceStatus(isSourceDirty() ? "有未套用的變更" : "", isSourceDirty() ? "err" : "");
});

// 資產頁分類入口（總覽 / 角色 / 各檔案類別 / 位置與錨點）
const ASSET_VIEWS = {
  overview: "#asset-overview",
  characters: "#asset-characters-page",
  backgrounds: "#asset-kind-backgrounds",
  bgm: "#asset-kind-bgm",
  se: "#asset-kind-se",
  voice: "#asset-kind-voice",
  video: "#asset-kind-video",
  positions: "#position-editor",
};
function setAssetView(view) {
  document.querySelectorAll(".asset-nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.assetView === view));
  for (const [v, sel] of Object.entries(ASSET_VIEWS)) {
    $(sel).style.display = v === view ? "" : "none";
  }
  // 角色頁在隱藏時量不到尺寸（裁切框無法定位），現身時重繪一次
  if (view === "characters") characterManager.render();
}
document.querySelectorAll(".asset-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => setAssetView(btn.dataset.assetView));
});

// 敘事地圖左欄分頁（地圖 / 變數管理 / 結局）
const MAP_VIEWS = {
  graph: "#map-graph-view",
  chapters: "#map-chapters-view",
  flags: "#map-flags-view",
  endings: "#map-endings-view",
};
let currentMapView = "graph";
function setMapView(view) {
  currentMapView = view;
  document.querySelectorAll(".map-nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mapView === view));
  for (const [v, sel] of Object.entries(MAP_VIEWS)) {
    $(sel).style.display = v === view ? "" : "none";
  }
  if (view === "graph") graphView.render();
  else if (view === "chapters") chapterManager.render();
}
document.querySelectorAll(".map-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMapView(btn.dataset.mapView));
});

// 檢查器分頁（問題 / 檢查器）
document.querySelectorAll(".insp-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".insp-tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".insp-panel").forEach((p) => {
      p.style.display = p.id === tab.dataset.target ? "" : "none";
    });
  });
});

// 場景搜尋
$("#scene-search").addEventListener("input", () => {
  sceneFilter = $("#scene-search").value.trim().toLowerCase();
  renderSidebar();
});

// 鍵盤快捷鍵
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    $("#btn-save").click();
  } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    $("#btn-undo").click();
  } else if (((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "y")) {
    e.preventDefault();
    $("#btn-redo").click();
  }
});

// 離開提示
window.addEventListener("beforeunload", (e) => {
  if (project.hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = "有未儲存的變更，確定離開？";
    return e.returnValue;
  }
});

// ==================== 全域搜尋（S7）====================

function jumpToInstruction(sceneId, index, color = "var(--e-accent)") {
  currentSceneId = sceneId;
  setPage("script");
  renderSidebar();
  setTimeout(() => {
    if (index != null) {
      const row = document.querySelector(`.instr-row[data-index="${index}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.style.outline = `2px solid ${color}`;
        setTimeout(() => { row.style.outline = ""; }, 2000);
      }
    }
  }, 100);
}

const gsInput = $("#global-search");
const gsResults = $("#global-search-results");
let gsTimer = null;

function hideGlobalSearch() { gsResults.style.display = "none"; }

function runGlobalSearch() {
  const q = gsInput.value.trim();
  if (!q) { hideGlobalSearch(); return; }
  gsResults.style.display = "";
  gsResults.innerHTML = "";

  if (!project.storyMeta) {
    gsResults.innerHTML = `<div class="gs-empty">請先開啟專案</div>`;
    return;
  }
  const hits = project.searchAll(q, { limit: 80 });
  if (hits.length === 0) {
    gsResults.innerHTML = `<div class="gs-empty">沒有符合「${escapeHtml(q)}」的結果</div>`;
    return;
  }

  const head = document.createElement("div");
  head.className = "gs-head";
  head.textContent = `${hits.length} 筆結果${hits.length >= 80 ? "（已截斷）" : ""}`;
  gsResults.appendChild(head);

  for (const hit of hits) {
    const sc = project.getScene(hit.sceneId);
    const row = document.createElement("button");
    row.className = "gs-row";
    const snippet = hit.snippet.length > 60 ? hit.snippet.slice(0, 58) + "…" : hit.snippet;
    row.innerHTML =
      `<span class="gs-kind">${escapeHtml(hit.kind)}</span>` +
      `<span class="gs-scene">${escapeHtml(sc?.meta.title || hit.sceneId)}</span>` +
      `<span class="gs-snippet">${escapeHtml(snippet)}</span>`;
    row.addEventListener("click", () => {
      hideGlobalSearch();
      jumpToInstruction(hit.sceneId, hit.index);
    });
    gsResults.appendChild(row);
  }
}

gsInput.addEventListener("input", () => {
  clearTimeout(gsTimer);
  gsTimer = setTimeout(runGlobalSearch, 200);
});
gsInput.addEventListener("focus", () => { if (gsInput.value.trim()) runGlobalSearch(); });
document.addEventListener("click", (e) => {
  if (!e.target.closest(".global-search")) hideGlobalSearch();
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    gsInput.focus();
    gsInput.select();
  } else if (e.key === "Escape") {
    hideGlobalSearch();
  }
});

// Ctrl/Cmd+G：場景大綱（跳到選項／區塊／條件／背景切換）。
// 這裡刻意不排除輸入框——寫台詞寫到一半想跳去別處是常態。
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
    if (currentPage !== "script" || !currentSceneId) return;
    e.preventDefault();
    sceneEditor.openOutline();
  }
});

// ==================== 自動存檔（S7）====================

const autosave = createAutosave({
  project, fs,
  onStatus: ({ enabled, lastAt, error }) => {
    if (error) toast(`自動存檔失敗，已停用：${error.message}`, "error");
    localStorage.setItem("woven-autosave", enabled ? "on" : "off");
    renderAutosaveStatus();
    // 存檔成功後刷新側欄的 dirty 標記與工具列按鈕
    if (!error && enabled) { renderSidebar(); updateToolbar(); }
  },
});
autosave.setEnabled(localStorage.getItem("woven-autosave") !== "off");

function renderAutosaveStatus() {
  const btn = $("#status-autosave");
  const cb = $("#pref-autosave");
  const t = autosave.lastAt
    ? `（上次 ${autosave.lastAt.toLocaleTimeString("zh-TW", { hour12: false })}）`
    : "";
  btn.textContent = autosave.enabled ? `● 自動存檔${t}` : "○ 自動存檔：關閉";
  btn.classList.toggle("on", autosave.enabled);
  if (cb) cb.checked = autosave.enabled;
}

$("#status-autosave").addEventListener("click", () => autosave.setEnabled(!autosave.enabled));
$("#pref-autosave").addEventListener("change", (e) => autosave.setEnabled(e.target.checked));
renderAutosaveStatus();

// ==================== 訂閱專案變更 ====================

project.subscribe((type, payload) => {
  if (type === "loaded") {
    currentSceneId = project.storyMeta?.start || project.getAllSceneIds()[0] || null;
    renderEvents();
  }
  if (type === "scene-renamed" && payload?.oldId === currentSceneId) {
    currentSceneId = payload.newId;
    sceneEditor.currentSceneId = payload.newId;
  }
  renderSidebar();
  updateToolbar();
  // 部分變更要重繪主區。
  //
  // instruction-updated 也必須在內：改一條指令的內容常常會改變它的「形狀」——
  // 新增／刪除／排序選項、增減選項的變數，都是走 updateInstruction。少了它，
  // 資料改了但畫面不動，使用者以為沒生效就再點一次；刪除尤其危險，那一列還在
  // 畫面上，再按一次就刪掉了下一個。
  //
  // 不會干擾打字：所有輸入框都是綁 change（失焦或 Enter 才觸發），沒有任何
  // input 事件會呼叫 onChange（textarea 的 input 只用來自動長高）。
  if (type === "instruction-updated" ||
      type === "instruction-inserted" || type === "instruction-deleted" ||
      type === "instruction-moved" || type === "instructions-replaced" ||
      type === "undo" || type === "redo" || type === "resources-updated" ||
      type === "characters-updated" || type === "flags-updated" || type === "story-meta-updated" ||
      type === "chapters-updated" || type === "positions-updated") {
    if (currentPage === "script") renderEvents();
  }
  // 影響 graph 結構的變更
  if (type === "loaded" || type === "scene-created" || type === "scene-deleted" ||
      type === "scene-renamed" || type === "instruction-inserted" ||
      type === "instruction-deleted" || type === "instructions-replaced" ||
      type === "instruction-updated" || type === "scene-meta-updated" ||
      type === "undo" || type === "redo") {
    if (currentPage === "map") graphView.render();
  }
});

// ==================== 畫面渲染 ====================

function renderAll() {
  renderSidebar();
  if (currentPage === "map") {
    graphView.render();
  } else {
    renderEvents();
  }
  updateToolbar();
}

function renderSidebar() {
  const list = $("#scene-list");
  list.innerHTML = "";
  const allIds = project.getAllSceneIds();
  const startId = project.storyMeta?.start;
  // 搜尋過濾（比對場景標題與 id）
  const ids = sceneFilter
    ? allIds.filter((id) => {
        const sc = project.getScene(id);
        return id.toLowerCase().includes(sceneFilter) ||
               String(sc.meta.title || "").toLowerCase().includes(sceneFilter);
      })
    : allIds;
  // 依章節分組（輕量分層）：章節順序 → 未分類
  const shown = new Set(ids);
  const groups = [];
  for (const ch of project.getChapters()) {
    const inCh = (ch.scenes || []).filter((id) => shown.has(id));
    if (inCh.length) groups.push({ title: ch.title || ch.id, ids: inCh });
  }
  const grouped = new Set(groups.flatMap((g) => g.ids));
  const rest = ids.filter((id) => !grouped.has(id));
  if (rest.length) groups.push({ title: groups.length ? "未分類" : null, ids: rest });

  for (const g of groups) {
    if (g.title) {
      const head = document.createElement("li");
      head.className = "chapter-head";
      head.textContent = g.title;
      list.appendChild(head);
    }
    for (const id of g.ids) {
      const sc = project.getScene(id);
      const hasEnding = sc.instructions.some(i => i.type === "ending");
      const item = document.createElement("li");
      item.className = "scene-item";
      if (id === currentSceneId) item.classList.add("active");
      if (id === startId) item.classList.add("start");
      if (hasEnding) item.classList.add("ending");
      if (sc.dirty) item.classList.add("dirty");
      item.innerHTML = `
        <div style="flex:1;overflow:hidden;">
          <div class="scene-title">${escapeHtml(sc.meta.title || id)}</div>
          <div class="scene-subtitle">${escapeHtml(id)}</div>
        </div>
      `;
      item.addEventListener("click", async () => {
        if ((viewMode === "md" || viewMode === "json") && isSourceDirty() &&
            !(await confirmDialog({
              title: "捨棄未套用的變更？",
              message: "原始碼有未套用的變更，切換場景後會捨棄。",
              confirmText: "捨棄並切換", danger: true,
            }))) return;
        currentSceneId = id;
        renderEvents();
        renderSidebar();
      });
      list.appendChild(item);
    }
  }

  if (ids.length === 0) {
    const empty = document.createElement("li");
    empty.className = "panel-empty";
    empty.textContent = allIds.length === 0 ? "還沒有場景" : "沒有符合搜尋的場景";
    list.appendChild(empty);
  }

  // 場景總數顯示（有過濾時顯示 n/總數）
  $("#scene-count").textContent = sceneFilter
    ? `${ids.length} / ${allIds.length} 個場景`
    : `${allIds.length} 個場景`;
}

function updateToolbar() {
  $("#project-name").textContent = fs.rootHandle ? fs.projectName : "(未開啟專案)";
  $("#dirty-indicator").style.display = project.hasUnsavedChanges() ? "inline-block" : "none";
  $("#btn-undo").disabled = !project.canUndo();
  $("#btn-redo").disabled = !project.canRedo();
  $("#btn-save").disabled = !project.hasUnsavedChanges();
  $("#btn-delete-scene").disabled = !currentSceneId;
  updateStatusBar();
}

function updateStatusBar() {
  $("#status-project").textContent = fs.rootHandle ? `專案：${fs.projectName}` : "未開啟專案";
  $("#status-backend").textContent = usingMemory
    ? "記憶體模式（ZIP / IndexedDB）"
    : "資料夾模式（File System Access）";
  $("#status-scenes").textContent = project.storyMeta
    ? `${project.getAllSceneIds().length} 個場景`
    : "";
}

// ==================== 檢查器（S3d）====================

// 顯示選取指令的細部參數。用 SceneJson.toObject 剝除推導欄位，
// 確保這裡看到的就是「真正被序列化的內容」，不會混入內部索引。
function renderInspector(sceneId, index) {
  const host = $("#inspector-panel");
  const sc = sceneId ? project.getScene(sceneId) : null;
  const ins = sc?.instructions?.[index];

  if (!ins) {
    host.innerHTML = `<div class="panel-empty">選取指令後，這裡會顯示細部參數。</div>`;
    return;
  }

  // 多參數指令（含 @show 的定位）：schema 驅動的可編輯檢查器
  if (ins.type === "directive" && DIRECTIVE_SCHEMAS[ins.name]) {
    renderDirectiveForm(host, ins, DIRECTIVE_SCHEMAS[ins.name],
      (args) => updateDirectiveArgs(sceneId, index, args),
      { context: { project, onManage: handleManage } });
    return;
  }

  const clean = SceneJson.toObject({ meta: {}, instructions: [ins] }).instructions[0];
  const rows = [["行號", String(index + 1)],
                ["類型", clean.type + (clean.name ? ` · @${clean.name}` : "")]];

  for (const [k, v] of Object.entries(clean)) {
    if (k === "type" || k === "name") continue;
    if (k === "args" && v && typeof v === "object") {
      const pos = (v.positional || []).filter((x) => x !== "" && x != null);
      if (pos.length) rows.push(["參數", pos.join("  ")]);
      for (const [ak, av] of Object.entries(v)) {
        if (ak === "positional") continue;
        rows.push([ak, String(av)]);
      }
      continue;
    }
    rows.push([k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
  }

  host.innerHTML = `
    <div class="insp-body">
      ${rows.map(([k, v]) =>
        `<div class="insp-row"><span class="insp-k">${escapeHtml(k)}</span><span class="insp-v">${escapeHtml(v)}</span></div>`
      ).join("")}
    </div>
    <div class="insp-note">唯讀檢視。可編輯的細部參數會在 S6（複雜演出指令）加入後補上。</div>
  `;
}

// 寫回 schema 驅動指令的完整 args（表單已去空值），並即時預覽
function updateDirectiveArgs(sceneId, index, args) {
  const ins = project.getScene(sceneId)?.instructions?.[index];
  if (!ins) return;
  project.updateInstruction(sceneId, index, { args });
  renderInspector(sceneId, index);          // 重繪自身（欄位與提示同步）
  previewPanel.scrub(sceneId, index);       // 立刻在預覽看到結果
}

// ==================== 通用工具 ====================

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 初始狀態：還沒開啟專案時顯示歡迎畫面
$("#main-content").innerHTML = `
  <div class="main-empty">
    <div>
      <h2>織夢劇本編輯器</h2>
      <p>點選工具列的 <code>開啟專案</code> 選擇你的故事資料夾<br>（例如：<code>public/stories/demo_story</code>）</p>
      <p>或按 <code>新專案</code> 建立全新的故事。</p>
      <p style="margin-top:30px;font-size:11px;color:var(--e-text-faded)">
        儲存的內容會直接寫回原本的 Markdown 檔案。
      </p>
    </div>
  </div>
`;
updateToolbar();

// ==================== 記憶體模式：啟動提示 + 還原 ====================
if (usingMemory) {
  toast("記憶體模式：此瀏覽器無法直接存取資料夾，請用「⬇ ZIP」匯出保存（下次用「開啟專案」選該 ZIP 匯入）。", "info");
  (async () => {
    try {
      const restored = await fs.restore();
      if (restored) {
        await project.loadAll();
        toast(`已從瀏覽器儲存還原上次專案：${fs.projectName}`, "success");
        renderAll();
      }
    } catch (err) {
      console.error("還原失敗", err);
    }
  })();
}
