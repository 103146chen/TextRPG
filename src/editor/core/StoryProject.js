// ============================================
// StoryProject.js
// 編輯器內部的完整專案狀態
// 包含 story.json 與所有場景資料，是單一真相來源
// ============================================

import { SceneParser } from "../../engine/SceneParser.js";
import { MarkdownWriter } from "./MarkdownWriter.js";

export class StoryProject {
  constructor(fs) {
    this.fs = fs;                    // ProjectFileSystem 實例
    this.storyMeta = null;           // story.json 內容
    this.scenes = new Map();         // sceneId -> { fileName, meta, instructions, dirty }
    this.resources = {               // 資源清單
      backgrounds: [],
      characters: [],
      bgm: [],
      se: [],
    };
    this.listeners = new Set();      // 變更訂閱者（給 UI 重繪用）
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 50;
  }

  // ==================== 訂閱 ====================

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(changeType = "change", payload = null) {
    for (const fn of this.listeners) {
      try { fn(changeType, payload); } catch (e) { console.error(e); }
    }
  }

  // ==================== 載入 ====================

  async loadAll() {
    this.storyMeta = await this.fs.readStoryJson();
    this.scenes.clear();
    const sceneFiles = await this.fs.listScenes();
    for (const fileName of sceneFiles) {
      const raw = await this.fs.readScene(fileName);
      const parsed = SceneParser.parse(raw);
      const sceneId = parsed.meta.id || fileName.replace(/\.md$/, "");
      this.scenes.set(sceneId, {
        fileName,
        meta: parsed.meta,
        instructions: parsed.instructions,
        dirty: false,
        raw,            // 保留原始文字，比對是否真的被改動
      });
    }
    // 載入資源清單
    this.resources.backgrounds = await this.fs.listResources("backgrounds");
    this.resources.characters = await this.fs.listResources("characters");
    this.resources.bgm = await this.fs.listResources("bgm");
    this.resources.se = await this.fs.listResources("se");

    this.undoStack = [];
    this.redoStack = [];
    this.notify("loaded");
  }

  // ==================== 儲存 ====================

  async saveAll() {
    // 儲存被改過的場景
    for (const [sceneId, sc] of this.scenes) {
      if (sc.dirty) {
        const md = MarkdownWriter.write({ meta: sc.meta, instructions: sc.instructions });
        await this.fs.writeScene(sc.fileName, md);
        sc.raw = md;
        sc.dirty = false;
      }
    }
    // 總是重寫 story.json（影響不大）
    await this.fs.writeStoryJson(this.storyMeta);
    this.notify("saved");
  }

  async saveScene(sceneId) {
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    const md = MarkdownWriter.write({ meta: sc.meta, instructions: sc.instructions });
    await this.fs.writeScene(sc.fileName, md);
    sc.raw = md;
    sc.dirty = false;
    this.notify("scene-saved", { sceneId });
  }

  hasUnsavedChanges() {
    for (const sc of this.scenes.values()) {
      if (sc.dirty) return true;
    }
    return false;
  }

  // ==================== 場景操作 ====================

  getScene(sceneId) {
    return this.scenes.get(sceneId);
  }

  getAllSceneIds() {
    return Array.from(this.scenes.keys());
  }

  markDirty(sceneId) {
    const sc = this.scenes.get(sceneId);
    if (sc) { sc.dirty = true; this.notify("dirty", { sceneId }); }
  }

  async createScene(sceneId, { title = "", background = "", bgm = "" } = {}) {
    if (this.scenes.has(sceneId)) {
      throw new Error(`場景 ID 已存在: ${sceneId}`);
    }
    const fileName = `${sceneId}.md`;
    this.scenes.set(sceneId, {
      fileName,
      meta: { id: sceneId, title, ...(background && { background }), ...(bgm && { bgm }) },
      instructions: [],
      dirty: true,
      raw: null,
    });
    this.notify("scene-created", { sceneId });
    return sceneId;
  }

  async deleteScene(sceneId) {
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    try {
      await this.fs.deleteScene(sc.fileName);
    } catch (e) {
      console.warn("檔案刪除失敗（可能尚未存檔）", e);
    }
    this.scenes.delete(sceneId);
    this.notify("scene-deleted", { sceneId });
  }

  async renameScene(oldId, newId) {
    if (oldId === newId) return;
    if (this.scenes.has(newId)) throw new Error(`場景 ID 已存在: ${newId}`);
    const sc = this.scenes.get(oldId);
    if (!sc) return;
    const oldFileName = sc.fileName;
    const newFileName = `${newId}.md`;
    sc.fileName = newFileName;
    sc.meta.id = newId;
    sc.dirty = true;

    this.scenes.delete(oldId);
    this.scenes.set(newId, sc);

    // 同步更新所有 goto/next 引用
    for (const other of this.scenes.values()) {
      if (other.meta.next === oldId) { other.meta.next = newId; other.dirty = true; }
      for (const ins of other.instructions) {
        if (ins.type === "goto" && ins.target === oldId) { ins.target = newId; other.dirty = true; }
        if (ins.type === "choice") {
          for (const opt of ins.options) {
            if (opt.goto === oldId) { opt.goto = newId; other.dirty = true; }
          }
        }
      }
    }

    // 檔案層的 rename
    try {
      await this.fs.renameScene(oldFileName, newFileName);
    } catch (e) {
      console.warn("檔案改名失敗，可能尚未存檔：", e);
    }
    this.notify("scene-renamed", { oldId, newId });
  }

  // ==================== 指令層操作 ====================

  /**
   * 在場景中的指定位置插入指令
   */
  insertInstruction(sceneId, index, instruction) {
    this.#pushUndo();
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    sc.instructions.splice(index, 0, instruction);
    this.markDirty(sceneId);
    this.notify("instruction-inserted", { sceneId, index, instruction });
  }

  updateInstruction(sceneId, index, patch) {
    this.#pushUndo();
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    sc.instructions[index] = { ...sc.instructions[index], ...patch };
    this.markDirty(sceneId);
    this.notify("instruction-updated", { sceneId, index });
  }

  deleteInstruction(sceneId, index) {
    this.#pushUndo();
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    sc.instructions.splice(index, 1);
    this.markDirty(sceneId);
    this.notify("instruction-deleted", { sceneId, index });
  }

  moveInstruction(sceneId, fromIdx, toIdx) {
    this.#pushUndo();
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    const [moved] = sc.instructions.splice(fromIdx, 1);
    sc.instructions.splice(toIdx, 0, moved);
    this.markDirty(sceneId);
    this.notify("instruction-moved", { sceneId, fromIdx, toIdx });
  }

  /**
   * 替換整個 instructions（用於批次修改，例如貼上條件區塊）
   */
  replaceInstructions(sceneId, newInstructions) {
    this.#pushUndo();
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    sc.instructions = newInstructions;
    this.markDirty(sceneId);
    this.notify("instructions-replaced", { sceneId });
  }

  updateSceneMeta(sceneId, patch) {
    this.#pushUndo();
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    sc.meta = { ...sc.meta, ...patch };
    this.markDirty(sceneId);
    this.notify("scene-meta-updated", { sceneId });
  }

  // ==================== Story meta 操作 ====================

  updateStoryMeta(patch) {
    this.#pushUndo();
    this.storyMeta = { ...this.storyMeta, ...patch };
    this.notify("story-meta-updated");
  }

  upsertCharacter(name, data) {
    this.#pushUndo();
    if (!this.storyMeta.characters) this.storyMeta.characters = {};
    this.storyMeta.characters[name] = data;
    this.notify("characters-updated");
  }

  removeCharacter(name) {
    this.#pushUndo();
    if (this.storyMeta.characters) delete this.storyMeta.characters[name];
    this.notify("characters-updated");
  }

  // ==================== Undo / Redo ====================

  #pushUndo() {
    const snapshot = this.#snapshot();
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  #snapshot() {
    // 深度拷貝：只複製會變動的部分
    return {
      storyMeta: JSON.parse(JSON.stringify(this.storyMeta)),
      scenes: Array.from(this.scenes.entries()).map(([id, sc]) => [
        id,
        {
          fileName: sc.fileName,
          meta: JSON.parse(JSON.stringify(sc.meta)),
          instructions: JSON.parse(JSON.stringify(sc.instructions)),
          dirty: sc.dirty,
          raw: sc.raw,
        }
      ]),
    };
  }

  #restore(snapshot) {
    this.storyMeta = snapshot.storyMeta;
    this.scenes = new Map(snapshot.scenes);
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(this.#snapshot());
    const prev = this.undoStack.pop();
    this.#restore(prev);
    this.notify("undo");
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(this.#snapshot());
    const next = this.redoStack.pop();
    this.#restore(next);
    this.notify("redo");
    return true;
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
}
