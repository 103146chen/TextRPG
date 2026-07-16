// ============================================
// preview.js
// 即時預覽宿主：以 iframe 內嵌於編輯器，透過 postMessage 接收
// 記憶體中的劇本資料（含未存檔變更），用共用的 GameRuntime 播放。
// 資產（立繪／背景／音訊）以「向父視窗要 Blob」的方式取得，支援任意本機資料夾。
// ============================================

import { GameRuntime } from "./ui/GameRuntime.js";

const $ = (sel) => document.querySelector(sel);
const gameScreen = $("#game-screen");
const emptyHint = $("#preview-empty");

let runtime = null;
let currentData = null;            // 最近一次 preview:load 的資料
let currentMode = "scrub";         // scrub（靜態，跟隨游標）| play（實際播放）
const assetCache = new Map();      // "kind/file" -> objectURL
const pendingAssets = new Map();   // reqId -> resolve
let assetReqSeq = 0;

// ---------- 與父視窗（編輯器）溝通 ----------

function postToParent(msg) {
  parent.postMessage(msg, "*");
}

// resolveAsset：向父視窗要檔案 Blob，於本頁建立 object URL（同源安全）
function resolveAsset(kind, file) {
  if (!file) return Promise.resolve(null);
  const key = `${kind}/${file}`;
  if (assetCache.has(key)) return Promise.resolve(assetCache.get(key));

  return new Promise((resolve) => {
    const reqId = `a${++assetReqSeq}`;
    pendingAssets.set(reqId, (blob) => {
      if (!blob) { resolve(null); return; }
      const url = URL.createObjectURL(blob);
      assetCache.set(key, url);
      resolve(url);
    });
    postToParent({ type: "preview:asset-request", reqId, kind, file });
    // 逾時保護：父視窗沒回應就退回 null（讓引擎自己 fallback placeholder）
    setTimeout(() => {
      if (pendingAssets.has(reqId)) {
        pendingAssets.delete(reqId);
        resolve(null);
      }
    }, 4000);
  });
}

function clearAssetCache() {
  for (const url of assetCache.values()) URL.revokeObjectURL(url);
  assetCache.clear();
}

// ---------- 建立 / 重建執行期 ----------

async function loadPreview(data) {
  currentData = data;
  const { storyMeta, scenes, startSceneId, startPc, mode = "scrub" } = data;
  currentMode = mode;

  // 收拾上一輪
  if (runtime) {
    try { runtime.stopAmbient(); } catch {}
  }
  clearAssetCache();
  // 清空畫面圖層
  $("#background-layer").style.backgroundImage = "";
  document.querySelectorAll(".char-slot").forEach((el) => (el.innerHTML = ""));
  $("#choice-container").innerHTML = "";
  $("#choice-container").classList.add("hidden");

  runtime = new GameRuntime({
    dom: {
      textContent: $("#text-content"),
      speakerName: $("#speaker-name"),
      textIndicator: $("#text-indicator"),
      choiceContainer: $("#choice-container"),
      characterLayer: $("#character-layer"),
      backgroundLayer: $("#background-layer"),
      screen: gameScreen,
    },
    storyMeta,
    sceneLoader: (sceneId) => {
      const raw = scenes[sceneId];
      return raw != null ? Promise.resolve(raw) : Promise.reject(new Error(`預覽缺少場景 ${sceneId}`));
    },
    metaLoader: () => Promise.resolve(storyMeta),
    resolveAsset,
    onEnding: () => { /* 預覽走到結局後停在原地，作者可按「從頭」重播 */ },
  });

  emptyHint.style.display = "none";
  gameScreen.classList.remove("hidden");
  setModeBadge(mode);

  // scrub：靜態求值到游標位置（不播動畫/不出聲/不等待）
  // play ：實際從該點開始播放
  runtime.setInstant(mode === "scrub");

  const sceneId = startSceneId || storyMeta.start;
  try {
    if (mode === "play") {
      await runtime.startAtScene(sceneId, startPc || 0);
    } else {
      const r = await runtime.evaluateTo(sceneId, startPc ?? 0);
      setStopReason(r);
    }
  } catch (err) {
    showError(err.message);
  }
}

function setModeBadge(mode) {
  const el = document.getElementById("preview-mode");
  if (!el) return;
  el.textContent = mode === "play" ? "▶ 播放中" : "靜態預覽 · 跟隨游標";
  el.dataset.mode = mode;
}

// 求值沒走到游標位置時，說明原因（誠實告知，不假裝畫面是對的）
function setStopReason(r) {
  const el = document.getElementById("preview-note");
  if (!el) return;
  const map = {
    choice: "停在選項：需要玩家選擇才能繼續",
    ended: "停在結局",
    "scene-changed": "此處跳轉到別的場景",
    "end-of-scene": "已到場景結尾",
    "max-steps": "偵測到迴圈，已停止求值",
  };
  const msg = r.reached ? "" : (map[r.stoppedAt] || "");
  el.textContent = msg;
  el.style.display = msg ? "" : "none";
}

function showError(message) {
  emptyHint.textContent = `預覽失敗：${message}`;
  emptyHint.style.display = "flex";
  gameScreen.classList.add("hidden");
}

// ---------- 訊息處理 ----------

window.addEventListener("message", (e) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "preview:load":
      loadPreview(msg).catch((err) => showError(err.message));
      break;
    case "preview:asset-response": {
      const cb = pendingAssets.get(msg.reqId);
      if (cb) { pendingAssets.delete(msg.reqId); cb(msg.blob || null); }
      break;
    }
  }
});

// ---------- 前進互動 ----------

gameScreen.addEventListener("click", (e) => {
  if (e.target.closest(".choice-container")) return;
  if (runtime && currentMode === "play") runtime.handleAdvanceInput();
});

document.addEventListener("keydown", (e) => {
  if (!runtime || currentMode !== "play" || gameScreen.classList.contains("hidden")) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    runtime.handleAdvanceInput();
  }
});

$("#preview-restart")?.addEventListener("click", () => {
  if (currentData) loadPreview(currentData);
});

// 通知父視窗：預覽頁已就緒，可以傳資料了
postToParent({ type: "preview:ready" });
