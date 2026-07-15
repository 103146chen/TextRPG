// ============================================
// main.js
// 主入口：裝配遊戲執行期（GameRuntime）與應用外殼（標題／存讀檔／圖鑑）
// ============================================

import { StoryEngine } from "./engine/StoryEngine.js";
import { SaveManager } from "./engine/SaveManager.js";
import { GameRuntime } from "./ui/GameRuntime.js";

// 設定：目前的劇本路徑
// 需透過 URL 參數 ?story=xxx 指定，例如 index.html?story=demo_story
// 若未指定，顯示提示畫面
const urlParams = new URLSearchParams(window.location.search);
const STORY_ID = urlParams.get("story") || null;
const STORY_PATH = STORY_ID ? `./public/stories/${STORY_ID}` : null;

// =====================================================
// DOM 引用
// =====================================================
const $ = sel => document.querySelector(sel);

const screens = {
  title: $("#title-screen"),
  game: $("#game-screen"),
  save: $("#save-screen"),
  gallery: $("#gallery-screen"),
  about: $("#about-screen"),
  loading: $("#loading-screen"),
  noStory: $("#no-story-screen"),
};

let runtime = null;
let saveMode = "save"; // "save" | "load"

// =====================================================
// 場景切換動畫
// =====================================================
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) {
    el.classList.toggle("hidden", k !== name);
  }
}

// =====================================================
// 初始化遊戲執行期
// =====================================================
async function initRuntime() {
  showScreen("loading");

  // 載入 story.json 取得角色等設定
  const metaRes = await fetch(`${STORY_PATH}/story.json`);
  const storyMeta = await metaRes.json();

  runtime = new GameRuntime({
    dom: {
      textContent: $("#text-content"),
      speakerName: $("#speaker-name"),
      textIndicator: $("#text-indicator"),
      choiceContainer: $("#choice-container"),
      characterLayer: $("#character-layer"),
      backgroundLayer: $("#background-layer"),
    },
    storyMeta,
    storyPath: STORY_PATH,
    onEnding: () => goToTitle(),
  });

  // 更新標題
  $(".game-title").textContent = storyMeta.title || "織夢";
  if (storyMeta.subtitle) {
    $(".game-subtitle").textContent = `— ${storyMeta.subtitle} —`;
  }
}

// =====================================================
// 互動：點擊前進
// =====================================================
function setupGameClicks() {
  $("#game-screen").addEventListener("click", (e) => {
    // 點擊控制列、選項區、設定按鈕時不前進
    if (e.target.closest(".game-controls")) return;
    if (e.target.closest(".choice-container")) return;
    runtime.handleAdvanceInput();
  });
}

// =====================================================
// 控制列
// =====================================================
function setupGameControls() {
  document.querySelectorAll(".ctrl-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ctrl = btn.dataset.ctrl;
      switch (ctrl) {
        case "font-plus":
          runtime.textBox.changeFontSize(2);
          break;
        case "font-minus":
          runtime.textBox.changeFontSize(-2);
          break;
        case "back":
          if (runtime.canRollback()) {
            await runtime.rollback();
          }
          break;
        case "save":
          openSaveScreen("save");
          break;
        case "load":
          openSaveScreen("load");
          break;
        case "title":
          goToTitle();
          break;
      }
    });
  });
}

// =====================================================
// 標題畫面選單
// =====================================================
function setupTitleMenu() {
  document.querySelectorAll(".title-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      switch (action) {
        case "start":
          showScreen("game");
          await runtime.startNewGame();
          break;
        case "load":
          openSaveScreen("load");
          break;
        case "gallery":
          openGallery();
          break;
        case "about":
          showScreen("about");
          break;
      }
    });
  });
}

function goToTitle() {
  runtime.stopAmbient();
  showScreen("title");
}

// =====================================================
// 存讀檔畫面
// =====================================================
function openSaveScreen(mode) {
  saveMode = mode;
  $("#save-title").textContent = mode === "save" ? "儲存進度" : "讀取進度";
  renderSaveSlots();
  showScreen("save");
}

function renderSaveSlots() {
  const container = $("#save-slots");
  container.innerHTML = "";
  const slots = SaveManager.listAll(runtime.storyMeta.id);

  for (const { slot, data } of slots) {
    const div = document.createElement("div");
    div.className = "save-slot";

    if (data) {
      const dt = new Date(data.savedAt).toLocaleString("zh-TW", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
      div.innerHTML = `
        <div class="save-slot-header">
          <span class="save-slot-num">檔案 ${String(slot).padStart(2, "0")}</span>
          <span class="save-slot-date">${dt}</span>
        </div>
        <div class="save-slot-preview">${escapeHtml(data.preview || "（無預覽）")}</div>
        <div class="save-slot-delete" data-delete="${slot}">刪除</div>
      `;
    } else {
      div.innerHTML = `
        <div class="save-slot-header">
          <span class="save-slot-num">檔案 ${String(slot).padStart(2, "0")}</span>
        </div>
        <div class="save-slot-empty">—— 空檔案 ——</div>
      `;
    }

    div.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete]")) {
        e.stopPropagation();
        if (confirm(`確定刪除檔案 ${slot}？`)) {
          SaveManager.delete(runtime.storyMeta.id, slot);
          renderSaveSlots();
        }
        return;
      }
      handleSaveSlotClick(slot, data);
    });

    container.appendChild(div);
  }
}

async function handleSaveSlotClick(slot, data) {
  if (saveMode === "save") {
    if (!runtime.state.sceneId) {
      alert("尚未開始遊戲");
      return;
    }
    if (data && !confirm(`檔案 ${slot} 已有資料，要覆寫嗎？`)) return;
    try {
      SaveManager.save(
        runtime.storyMeta.id,
        slot,
        runtime.serialize(),
        runtime.getPreviewText()
      );
    } catch (e) {
      alert(e.message);
      return;
    }
    renderSaveSlots();
  } else {
    if (!data) return;
    showScreen("game");
    const result = await runtime.loadState(data);
    if (result?.stale) {
      flashNotice("此存檔的劇本已更新，已盡力復原進度，位置可能略有偏差。");
    }
  }
}

// =====================================================
// 圖鑑
// =====================================================
function openGallery() {
  const grid = $("#gallery-grid");
  grid.innerHTML = "";

  const unlocked = StoryEngine.getUnlockedEndings(runtime.storyMeta.id);
  const allEndings = runtime.storyMeta.endings || [];

  allEndings.forEach((ending, idx) => {
    const isUnlocked = !!unlocked[ending.id];
    const div = document.createElement("div");
    div.className = `gallery-item ${isUnlocked ? "unlocked" : "locked"}`;
    div.innerHTML = `
      <div>
        <div class="gallery-item-num">結局 ${String(idx + 1).padStart(2, "0")}</div>
        <div class="gallery-item-title">${isUnlocked ? escapeHtml(ending.title) : "???"}</div>
      </div>
      <div class="gallery-item-desc">
        ${isUnlocked ? escapeHtml(ending.description || "") : "未解鎖的結局"}
      </div>
    `;
    grid.appendChild(div);
  });

  if (allEndings.length === 0) {
    grid.innerHTML = '<p style="padding:2rem;text-align:center;color:rgba(245,239,227,0.5)">這個故事尚未設定結局列表</p>';
  }
  showScreen("gallery");
}

// =====================================================
// 通用
// =====================================================
function setupCloseButtons() {
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      // 如果遊戲正在進行，回到遊戲，否則回標題
      if (runtime.state.sceneId && !runtime.state.finished) {
        showScreen("game");
      } else {
        showScreen("title");
      }
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 非阻塞浮動提示（不依賴外部 CSS）
function flashNotice(message, ms = 4000) {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = [
    "position:fixed", "left:50%", "bottom:32px", "transform:translateX(-50%)",
    "max-width:80%", "padding:10px 18px", "border-radius:8px",
    "background:rgba(20,20,28,0.92)", "color:#fff", "font-size:14px",
    "line-height:1.5", "z-index:9999", "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
    "pointer-events:none", "opacity:0", "transition:opacity .25s",
  ].join(";");
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// =====================================================
// 啟動
// =====================================================
(async function main() {
  // 若未指定故事，顯示提示畫面
  if (!STORY_ID) {
    showScreen("noStory");
    return;
  }

  try {
    await initRuntime();
    setupTitleMenu();
    setupGameClicks();
    setupGameControls();
    setupCloseButtons();

    // 鍵盤快捷鍵
    document.addEventListener("keydown", (e) => {
      if (screens.game.classList.contains("hidden")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        runtime.handleAdvanceInput();
      } else if (e.key === "Escape") {
        goToTitle();
      }
    });

    showScreen("title");
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div style="padding:2rem;color:#f5efe3;background:#1a1814;height:100vh;">
      <h2>載入失敗</h2>
      <pre>${escapeHtml(err.message)}</pre>
      <p>請確認 <code>public/stories/${STORY_ID}/story.json</code> 是否存在。</p>
    </div>`;
  }
})();
