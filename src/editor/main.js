// ============================================
// main.js (編輯器)
// 組裝整個編輯器
// ============================================

import { ProjectFileSystem } from "./core/FileSystem.js";
import { StoryProject } from "./core/StoryProject.js";
import { SceneEditor } from "./views/SceneEditor.js";
import { GraphView } from "./views/GraphView.js";
import { LintPanel } from "./views/LintPanel.js";
import { FlagInspector } from "./views/FlagInspector.js";
import { StoryManager } from "./views/StoryManager.js";

const $ = s => document.querySelector(s);

// ==================== 瀏覽器支援檢查 ====================

if (!ProjectFileSystem.isSupported()) {
  document.body.innerHTML = `
    <div class="browser-warning">
      <div class="browser-warning-content">
        <h1>瀏覽器不支援</h1>
        <p>這個編輯器需要使用 <strong>File System Access API</strong>，目前只有以下瀏覽器支援：</p>
        <p>✓ Chrome 86+<br>✓ Edge 86+<br>✓ Opera 72+</p>
        <p>很抱歉，Firefox 與 Safari 目前不支援。</p>
        <p style="margin-top:30px">
          <a href="./index.html" style="color:var(--e-accent)">← 返回遊戲</a>
        </p>
      </div>
    </div>
  `;
  throw new Error("unsupported browser");
}

// ==================== 初始化 ====================

const fs = new ProjectFileSystem();
const project = new StoryProject(fs);
const sceneEditor = new SceneEditor($("#main-content"), project);
const graphView = new GraphView($("#graph-content"), project, (sceneId) => {
  currentSceneId = sceneId;
  setView("scene");
});
const lintPanel = new LintPanel($("#lint-panel"), project, (sceneId, index) => {
  currentSceneId = sceneId;
  setView("scene");
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

const flagInspector = new FlagInspector($("#flag-panel"), project, (sceneId, index) => {
  currentSceneId = sceneId;
  setView("scene");
  setTimeout(() => {
    if (index !== null) {
      const row = document.querySelector(`.instr-row[data-index="${index}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.style.outline = "2px solid var(--e-accent)";
        setTimeout(() => { row.style.outline = ""; }, 2000);
      }
    }
  }, 100);
});

const storyManager = new StoryManager(project);

let currentSceneId = null;
let currentView = "scene"; // "scene" | "graph"

function setView(view) {
  currentView = view;
  $("#view-scene").classList.toggle("active", view === "scene");
  $("#view-graph").classList.toggle("active", view === "graph");
  $("#main-content").style.display = view === "scene" ? "" : "none";
  $("#graph-content").style.display = view === "graph" ? "" : "none";
  if (view === "graph") {
    graphView.render();
  } else {
    sceneEditor.openScene(currentSceneId);
  }
}

// ==================== 工具列 ====================

$("#btn-open").addEventListener("click", async () => {
  try {
    const name = await fs.openProject();
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
  const storyId = prompt("新專案的 ID（資料夾中的故事識別，例: my_story）", "new_story");
  if (!storyId) return;
  const title = prompt("故事標題", "新故事");
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

$("#btn-new-scene").addEventListener("click", () => {
  if (!fs.rootHandle) {
    toast("請先開啟專案", "error");
    return;
  }
  const sceneId = prompt("新場景的 ID（例: 02_相遇）", "");
  if (!sceneId) return;
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
  if (!confirm(`刪除場景「${currentSceneId}」？\n這個操作無法復原（檔案會被刪除）。`)) return;
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

$("#btn-story-settings").addEventListener("click", () => {
  if (!fs.rootHandle) { toast("請先開啟專案", "error"); return; }
  storyManager.open();
});

// 側邊面板 tab 切換
document.querySelectorAll(".side-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.target;
    document.querySelectorAll(".side-tab").forEach(t => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".side-panel").forEach(p => {
      p.style.display = p.id === target ? "" : "none";
    });
  });
});

$("#view-scene").addEventListener("click", () => setView("scene"));
$("#view-graph").addEventListener("click", () => setView("graph"));

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

// ==================== 訂閱專案變更 ====================

project.subscribe((type, payload) => {
  if (type === "loaded") {
    currentSceneId = project.storyMeta?.start || project.getAllSceneIds()[0] || null;
    sceneEditor.openScene(currentSceneId);
  }
  if (type === "scene-renamed" && payload?.oldId === currentSceneId) {
    currentSceneId = payload.newId;
    sceneEditor.currentSceneId = payload.newId;
  }
  renderSidebar();
  updateToolbar();
  // 部分變更要重繪主區
  if (type === "instruction-inserted" || type === "instruction-deleted" ||
      type === "instruction-moved" || type === "instructions-replaced" ||
      type === "undo" || type === "redo") {
    if (currentView === "scene") sceneEditor.render();
  }
  // 影響 graph 結構的變更
  if (type === "loaded" || type === "scene-created" || type === "scene-deleted" ||
      type === "scene-renamed" || type === "instruction-inserted" ||
      type === "instruction-deleted" || type === "instructions-replaced" ||
      type === "instruction-updated" || type === "scene-meta-updated" ||
      type === "undo" || type === "redo") {
    if (currentView === "graph") graphView.render();
  }
});

// ==================== 畫面渲染 ====================

function renderAll() {
  renderSidebar();
  if (currentView === "graph") {
    graphView.render();
  } else {
    sceneEditor.openScene(currentSceneId);
  }
  updateToolbar();
}

function renderSidebar() {
  const list = $("#scene-list");
  list.innerHTML = "";
  const ids = project.getAllSceneIds();
  const startId = project.storyMeta?.start;
  for (const id of ids) {
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
    item.addEventListener("click", () => {
      currentSceneId = id;
      sceneEditor.openScene(id);
      renderSidebar();
    });
    list.appendChild(item);
  }

  // 場景總數顯示
  $("#scene-count").textContent = `${ids.length} 個場景`;
}

function updateToolbar() {
  $("#project-name").textContent = fs.rootHandle ? fs.projectName : "(未開啟專案)";
  $("#dirty-indicator").style.display = project.hasUnsavedChanges() ? "inline-block" : "none";
  $("#btn-undo").disabled = !project.canUndo();
  $("#btn-redo").disabled = !project.canRedo();
  $("#btn-save").disabled = !project.hasUnsavedChanges();
  $("#btn-delete-scene").disabled = !currentSceneId;
}

// ==================== 通用工具 ====================

function toast(message, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

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
