// ============================================
// FileSystem.js
// File System Access API 封裝
// 支援 Chrome / Edge / Opera；其他瀏覽器需另作 fallback
// ============================================

export class ProjectFileSystem {
  constructor() {
    this.rootHandle = null;
    this.storyJsonHandle = null;
    this.scenesDirHandle = null;
    this.backgroundsDirHandle = null;
    this.charactersDirHandle = null;
    this.bgmDirHandle = null;
    this.seDirHandle = null;
    this.voiceDirHandle = null;
    this.videoDirHandle = null;
  }

  static isSupported() {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
  }

  /**
   * 讓使用者選擇一個故事資料夾（例：demo_story/）
   */
  async openProject() {
    if (!ProjectFileSystem.isSupported()) {
      throw new Error("此瀏覽器不支援 File System Access API。請使用 Chrome、Edge 或 Opera。");
    }
    // mode: 'readwrite' 取得寫入權限
    this.rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    await this.#resolveChildHandles();
    return this.rootHandle.name;
  }

  async #resolveChildHandles() {
    // 必要子項
    this.storyJsonHandle = await this.rootHandle.getFileHandle("story.json", { create: false });
    this.scenesDirHandle = await this.rootHandle.getDirectoryHandle("scenes", { create: true });
    // 選用子項（沒有就自動建立）
    this.backgroundsDirHandle = await this.rootHandle.getDirectoryHandle("backgrounds", { create: true });
    this.charactersDirHandle = await this.rootHandle.getDirectoryHandle("characters", { create: true });
    this.bgmDirHandle = await this.rootHandle.getDirectoryHandle("bgm", { create: true });
    this.seDirHandle = await this.rootHandle.getDirectoryHandle("se", { create: true });
    this.voiceDirHandle = await this.rootHandle.getDirectoryHandle("voice", { create: true });
    this.videoDirHandle = await this.rootHandle.getDirectoryHandle("video", { create: true });
  }

  /**
   * 建立新專案資料夾結構（story.json + scenes/）
   */
  async createNewProject(initialStoryMeta) {
    if (!ProjectFileSystem.isSupported()) {
      throw new Error("此瀏覽器不支援 File System Access API。");
    }
    this.rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    this.storyJsonHandle = await this.rootHandle.getFileHandle("story.json", { create: true });
    this.scenesDirHandle = await this.rootHandle.getDirectoryHandle("scenes", { create: true });
    this.backgroundsDirHandle = await this.rootHandle.getDirectoryHandle("backgrounds", { create: true });
    this.charactersDirHandle = await this.rootHandle.getDirectoryHandle("characters", { create: true });
    this.bgmDirHandle = await this.rootHandle.getDirectoryHandle("bgm", { create: true });
    this.seDirHandle = await this.rootHandle.getDirectoryHandle("se", { create: true });
    this.voiceDirHandle = await this.rootHandle.getDirectoryHandle("voice", { create: true });
    this.videoDirHandle = await this.rootHandle.getDirectoryHandle("video", { create: true });

    await this.writeStoryJson(initialStoryMeta);
    return this.rootHandle.name;
  }

  // ==================== 讀取 ====================

  async readStoryJson() {
    const file = await this.storyJsonHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  }

  async listScenes() {
    const names = [];
    for await (const [name, handle] of this.scenesDirHandle.entries()) {
      if (handle.kind === "file" && name.endsWith(".md")) {
        names.push(name);
      }
    }
    return names.sort();
  }

  async readScene(fileName) {
    const handle = await this.scenesDirHandle.getFileHandle(fileName);
    const file = await handle.getFile();
    return file.text();
  }

  // 讀取單一資源檔為 File(Blob)，供即時預覽以 blob URL 載入
  async readResource(kind, fileName) {
    const dirMap = {
      backgrounds: this.backgroundsDirHandle,
      characters: this.charactersDirHandle,
      bgm: this.bgmDirHandle,
      se: this.seDirHandle,
      voice: this.voiceDirHandle,
      video: this.videoDirHandle,
    };
    const dir = dirMap[kind];
    if (!dir) return null;
    try {
      const handle = await dir.getFileHandle(fileName);
      return await handle.getFile();   // File 繼承自 Blob，可經 postMessage 傳遞
    } catch {
      return null;
    }
  }

  // 寫入單一資源檔（匯入立繪／背景／BGM／音效）
  async writeResource(kind, fileName, blob) {
    const dirMap = {
      backgrounds: this.backgroundsDirHandle,
      characters: this.charactersDirHandle,
      bgm: this.bgmDirHandle,
      se: this.seDirHandle,
      voice: this.voiceDirHandle,
      video: this.videoDirHandle,
    };
    const dir = dirMap[kind];
    if (!dir) throw new Error(`未知的資源類型: ${kind}`);
    const handle = await dir.getFileHandle(fileName, { create: true });
    await ProjectFileSystem.#writeWithRetry(handle, blob);
  }

  async deleteResource(kind, fileName) {
    const dirMap = {
      backgrounds: this.backgroundsDirHandle,
      characters: this.charactersDirHandle,
      bgm: this.bgmDirHandle,
      se: this.seDirHandle,
      voice: this.voiceDirHandle,
      video: this.videoDirHandle,
    };
    const dir = dirMap[kind];
    if (!dir) return;
    try { await dir.removeEntry(fileName); } catch (e) { console.warn("刪除資源失敗", e); }
  }

  async listResources(kind) {
    // kind: "backgrounds" | "characters" | "bgm" | "se"
    const dirMap = {
      backgrounds: this.backgroundsDirHandle,
      characters: this.charactersDirHandle,
      bgm: this.bgmDirHandle,
      se: this.seDirHandle,
      voice: this.voiceDirHandle,
      video: this.videoDirHandle,
    };
    const dir = dirMap[kind];
    if (!dir) return [];
    const names = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "file") names.push(name);
    }
    return names.sort();
  }

  // ==================== 寫入 ====================

  /**
   * 實際寫入單一檔案，並對「檔案在磁碟上被外部改動」的情況重試。
   *
   * File System Access 的 createWritable() 若偵測到檔案自 handle 取得後曾被
   * 改動，會丟出 InvalidStateError。常見來源是同步工具（OneDrive/Dropbox）、
   * 防毒掃描或外部編輯器。這是暫時性的：重試會重新讀取磁碟狀態，通常第二次
   * 就成功。本專案就放在 OneDrive 底下，因此會偶發。
   */
  static async #writeWithRetry(handle, data, tries = 3) {
    for (let attempt = 1; ; attempt++) {
      try {
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        return;
      } catch (err) {
        if (err?.name !== "InvalidStateError" || attempt >= tries) throw err;
        await new Promise((r) => setTimeout(r, 120 * attempt));
      }
    }
  }

  async writeStoryJson(data) {
    const bom = '\uFEFF';
    await ProjectFileSystem.#writeWithRetry(
      this.storyJsonHandle, bom + JSON.stringify(data, null, 2));
  }

  async writeScene(fileName, markdownText) {
    const handle = await this.scenesDirHandle.getFileHandle(fileName, { create: true });
    const bom = '\uFEFF';
    const content = markdownText.startsWith(bom) ? markdownText : bom + markdownText;
    await ProjectFileSystem.#writeWithRetry(handle, content);
  }

  async deleteScene(fileName) {
    await this.scenesDirHandle.removeEntry(fileName);
  }

  async renameScene(oldName, newName) {
    // File System Access API 沒有 rename，要先讀再寫再刪
    const content = await this.readScene(oldName);
    await this.writeScene(newName, content);
    await this.deleteScene(oldName);
  }

  // ==================== 權限 ====================

  async verifyPermission(readWrite = true) {
    if (!this.rootHandle) return false;
    const opts = { mode: readWrite ? "readwrite" : "read" };
    if ((await this.rootHandle.queryPermission(opts)) === "granted") return true;
    if ((await this.rootHandle.requestPermission(opts)) === "granted") return true;
    return false;
  }

  get projectName() {
    return this.rootHandle?.name || "(未開啟)";
  }
}
