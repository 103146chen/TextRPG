// ============================================
// main.js
// 主入口：裝配引擎與 UI
// ============================================

import { StoryEngine } from "./engine/StoryEngine.js";
import { SaveManager } from "./engine/SaveManager.js";
import { TextBox } from "./ui/TextBox.js";
import { ChoiceMenu } from "./ui/ChoiceMenu.js";
import { CharacterLayer, BackgroundLayer } from "./ui/CharacterLayer.js";
import { AudioManager } from "./ui/AudioManager.js";

// 設定：目前的劇本路徑
// 可以透過 URL 參數 ?story=xxx 切換，例如 index.html?story=demo_story
// 預設載入秦得參劇本
const urlParams = new URLSearchParams(window.location.search);
const STORY_ID = urlParams.get("story") || "cheng_zi";
const STORY_PATH = `./public/stories/${STORY_ID}`;

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
};

const textBox = new TextBox({
  contentEl: $("#text-content"),
  speakerEl: $("#speaker-name"),
  indicatorEl: $("#text-indicator"),
});
const choiceMenu = new ChoiceMenu($("#choice-container"));
let characterLayer = null;
let backgroundLayer = null;
let audio = null;
let engine = null;

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
// 初始化引擎
// =====================================================
async function initEngine() {
  showScreen("loading");

  // 載入 story.json 取得角色等設定
  const metaRes = await fetch(`${STORY_PATH}/story.json`);
  const storyMeta = await metaRes.json();

  characterLayer = new CharacterLayer(
    $("#character-layer"),
    STORY_PATH,
    storyMeta.characters || {}
  );
  backgroundLayer = new BackgroundLayer($("#background-layer"), STORY_PATH);
  audio = new AudioManager(STORY_PATH);

  engine = new StoryEngine({
    storyPath: STORY_PATH,
    onText: handleText,
    onChoice: handleChoice,
    onDirective: handleDirective,
    onSceneChange: handleSceneChange,
    onEnding: handleEnding,
  });

  engine.storyMeta = storyMeta;

  // 更新標題
  $(".game-title").textContent = storyMeta.title || "織夢";
  if (storyMeta.subtitle) {
    $(".game-subtitle").textContent = `— ${storyMeta.subtitle} —`;
  }
}

// =====================================================
// 引擎回呼
// =====================================================
async function handleText(speaker, text, state) {
  if (speaker) characterLayer.setSpeaking(speaker);
  else characterLayer.clearSpeaking();
  await textBox.showText(speaker, text);

}

async function handleChoice(options) {
  const idx = await choiceMenu.show(options);
  engine.selectChoice(idx);
}

async function handleDirective(ins, state) {
  const { name, args } = ins;
  switch (name) {
    case "bg": {
      const file = args.positional[0];
      const fade = args.fade ?? 800;
      await backgroundLayer.change(file, fade);
      break;
    }
    case "show": {
      const [charName, slot = "center", emotion = null] = args.positional;
      await characterLayer.show(charName, slot, emotion);
      break;
    }
    case "hide": {
      const charName = args.positional[0];
      if (charName === "all") {
        await characterLayer.hideAll(args.fade ?? 400);
      } else {
        await characterLayer.hide(charName, args.fade ?? 400);
      }
      break;
    }
    case "move": {
      // @move alice center→left
      const [charName, movement] = args.positional;
      const [from, to] = movement.split(/[→\->]/).map(s => s.trim());
      const cur = Object.entries(characterLayer.current).find(
        ([, v]) => v?.charName === charName
      );
      if (cur) {
        const emotion = cur[1].emotion;
        await characterLayer.hide(charName, 200);
        await characterLayer.show(charName, to, emotion);
      }
      break;
    }
    case "bgm": {
      const file = args.positional[0];
      await audio.playBgm(file, { fadeIn: args.fade ?? 1000 });
      break;
    }
    case "bgm-stop":
    case "stopbgm": {
      await audio.stopBgm(args.fade ?? 500);
      break;
    }
    case "se": {
      audio.playSe(args.positional[0]);
      break;
    }
    case "wait": {
      const ms = parseInt(args.positional[0] || "500", 10);
      await new Promise(r => setTimeout(r, ms));
      break;
    }
    default:
      console.warn("未知指令:", name, args);
  }
}

async function handleSceneChange(sceneMeta) {
  // 應用場景預設的 bg 與 bgm（front matter 中的）
  if (sceneMeta.background) {
    await backgroundLayer.change(sceneMeta.background, 600);
  }
  if (sceneMeta.bgm) {
    await audio.playBgm(sceneMeta.bgm, { fadeIn: 800 });
  }
}

async function handleEnding(endingIns) {
  // 結局畫面：顯示「結局：XXX」訊息 → 回標題
  await new Promise(r => setTimeout(r, 500));
  await textBox.showText("", `—— 結局：${endingIns.title} ——`);
  await new Promise(r => setTimeout(r, 1500));
  await textBox.showText("", endingIns.desc || "你的故事走到了這裡。");
  await new Promise(r => setTimeout(r, 2000));
  goToTitle();
}

// =====================================================
// 互動：點擊前進
// =====================================================
function setupGameClicks() {
  $("#game-screen").addEventListener("click", (e) => {
    // 點擊控制列、選項區、設定按鈕時不前進
    if (e.target.closest(".game-controls")) return;
    if (e.target.closest(".choice-container")) return;

    const advanced = textBox.handleClick();
    if (advanced) {
      setTimeout(() => engine.advance(), 0);
    }
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
          textBox.changeFontSize(2);
          break;
        case "font-minus":
          textBox.changeFontSize(-2);
          break;
        case "back":
          if (engine.canRollback()) {
            await engine.rollback();
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
          await engine.startNewGame();
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
  audio.stopBgm(500);
  characterLayer.hideAll(300);
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
  const slots = SaveManager.listAll(engine.storyMeta.id);

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
          SaveManager.delete(engine.storyMeta.id, slot);
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
    if (!engine.state.sceneId) {
      alert("尚未開始遊戲");
      return;
    }
    if (data && !confirm(`檔案 ${slot} 已有資料，要覆寫嗎？`)) return;
    SaveManager.save(
      engine.storyMeta.id,
      slot,
      engine.serialize(),
      textBox.getPreview()
    );
    renderSaveSlots();
  } else {
    if (!data) return;
    showScreen("game");
    await engine.loadState(data);
  }
}

// =====================================================
// 圖鑑
// =====================================================
function openGallery() {
  const grid = $("#gallery-grid");
  grid.innerHTML = "";

  const unlocked = StoryEngine.getUnlockedEndings(engine.storyMeta.id);
  const allEndings = engine.storyMeta.endings || [];

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
      if (engine.state.sceneId && !engine.state.finished) {
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

// =====================================================
// 啟動
// =====================================================
(async function main() {
  try {
    await initEngine();
    setupTitleMenu();
    setupGameClicks();
    setupGameControls();
    setupCloseButtons();

    // 鍵盤快捷鍵
    document.addEventListener("keydown", (e) => {
      if (screens.game.classList.contains("hidden")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (textBox.handleClick()) {
          setTimeout(() => engine.advance(), 0);
        }
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
