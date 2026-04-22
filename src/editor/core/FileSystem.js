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

  async listResources(kind) {
    // kind: "backgrounds" | "characters" | "bgm" | "se"
    const dirMap = {
      backgrounds: this.backgroundsDirHandle,
      characters: this.charactersDirHandle,
      bgm: this.bgmDirHandle,
      se: this.seDirHandle,
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

  async writeStoryJson(data) {
    const writable = await this.storyJsonHandle.createWritable();
    const bom = '\uFEFF';
    await writable.write(bom + JSON.stringify(data, null, 2));
    await writable.close();
  }

  async writeScene(fileName, markdownText) {
    const handle = await this.scenesDirHandle.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    const bom = '\uFEFF';
    const content = markdownText.startsWith(bom) ? markdownText : bom + markdownText;
    await writable.write(content);
    await writable.close();
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
