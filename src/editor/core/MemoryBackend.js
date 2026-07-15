// ============================================
// MemoryBackend.js
// 記憶體儲存後端：實作與 ProjectFileSystem 相同的方法介面，
// 供不支援 File System Access API 的瀏覽器（Firefox / Safari）使用。
// 專案存在記憶體，透過 ZIP 匯入/匯出搬進搬出；並持久化到 IndexedDB，
// 讓重新整理後不會遺失。
// ============================================

import { exportProjectZip, importProjectZip } from "./projectZip.js";

const KINDS = ["backgrounds", "characters", "bgm", "se"];
const IDB_NAME = "galgame-editor";
const IDB_STORE = "projects";
const IDB_KEY = "current";

export class MemoryBackend {
  constructor() {
    this._name = "(未命名)";
    this.storyJson = null;                 // 物件
    this.scenes = new Map();               // fileName -> text
    this.resources = {                     // fileName -> Blob
      backgrounds: new Map(), characters: new Map(), bgm: new Map(), se: new Map(),
    };
    this.loaded = false;
    this._persistTimer = null;
  }

  static isSupported() { return true; }

  // 讓編輯器沿用「rootHandle 為 truthy 代表已開專案」的判斷
  get rootHandle() { return this.loaded ? { kind: "memory" } : null; }
  get projectName() { return this._name; }

  // ==================== 開啟 / 建立 ====================

  // 開啟：彈出 .zip 選擇並匯入
  async openProject() {
    const file = await this.#pickFile(".zip,application/zip");
    if (!file) throw new DOMException("使用者取消選檔", "AbortError");
    await this.#clear();
    await importProjectZip(this, await file.arrayBuffer());
    this._name = file.name.replace(/\.zip$/i, "") || "匯入的專案";
    this.loaded = true;
    await this.#persist();
    return this._name;
  }

  async createNewProject(initialStoryMeta) {
    await this.#clear();
    this.storyJson = JSON.parse(JSON.stringify(initialStoryMeta));
    this._name = initialStoryMeta.id || "新專案";
    this.loaded = true;
    await this.#persist();
    return this._name;
  }

  // 匯出目前專案為 ZIP Blob
  async exportZip() {
    return exportProjectZip(this);
  }

  async #clear() {
    this.storyJson = null;
    this.scenes.clear();
    for (const k of KINDS) this.resources[k].clear();
  }

  // ==================== 共用 fs 介面 ====================

  async readStoryJson() {
    if (!this.storyJson) throw new Error("尚未開啟專案");
    return JSON.parse(JSON.stringify(this.storyJson));
  }
  async writeStoryJson(data) {
    this.storyJson = JSON.parse(JSON.stringify(data));
    this.#schedulePersist();
  }

  async listScenes() {
    return [...this.scenes.keys()].filter((n) => n.endsWith(".md")).sort();
  }
  async readScene(fileName) {
    return this.scenes.get(fileName) ?? "";
  }
  async writeScene(fileName, text) {
    this.scenes.set(fileName, text);
    this.#schedulePersist();
  }
  async deleteScene(fileName) {
    this.scenes.delete(fileName);
    this.#schedulePersist();
  }
  async renameScene(oldName, newName) {
    if (!this.scenes.has(oldName)) return;
    this.scenes.set(newName, this.scenes.get(oldName));
    this.scenes.delete(oldName);
    this.#schedulePersist();
  }

  async listResources(kind) {
    return [...(this.resources[kind]?.keys() ?? [])].sort();
  }
  async readResource(kind, file) {
    return this.resources[kind]?.get(file) ?? null;
  }
  async writeResource(kind, file, blob) {
    this.resources[kind]?.set(file, blob);
    this.#schedulePersist();
  }
  async deleteResource(kind, file) {
    this.resources[kind]?.delete(file);
    this.#schedulePersist();
  }

  // ==================== IndexedDB 持久化 ====================

  #schedulePersist() {
    clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this.#persist(), 400);
  }

  async #persist() {
    if (!this.loaded) return;
    try {
      const record = {
        name: this._name,
        storyJson: this.storyJson,
        scenes: Object.fromEntries(this.scenes),
        resources: Object.fromEntries(
          KINDS.map((k) => [k, Object.fromEntries(this.resources[k])])
        ),
      };
      await idbPut(record);
    } catch (e) {
      console.warn("[MemoryBackend] 持久化失敗", e);
    }
  }

  // 從 IndexedDB 還原上次的專案；成功回傳 true
  async restore() {
    try {
      const record = await idbGet();
      if (!record || !record.storyJson) return false;
      this._name = record.name || "(未命名)";
      this.storyJson = record.storyJson;
      this.scenes = new Map(Object.entries(record.scenes || {}));
      for (const k of KINDS) {
        this.resources[k] = new Map(Object.entries((record.resources && record.resources[k]) || {}));
      }
      this.loaded = true;
      return true;
    } catch (e) {
      console.warn("[MemoryBackend] 還原失敗", e);
      return false;
    }
  }

  async clearPersisted() {
    try { await idbDelete(); } catch { /* ignore */ }
  }

  // ==================== 工具 ====================

  #pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.addEventListener("change", () => resolve(input.files[0] || null), { once: true });
      // 使用者取消時不會觸發 change；靠焦點回來偵測
      input.click();
    });
  }
}

// ---------- 極簡 IndexedDB 存取 ----------

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(record) {
  const db = await idbOpen();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record, IDB_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet() {
  const db = await idbOpen();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return record;
}

async function idbDelete() {
  const db = await idbOpen();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
