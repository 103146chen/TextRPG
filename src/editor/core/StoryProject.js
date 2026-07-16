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
      voice: [],
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
    this.resources.voice = await this.fs.listResources("voice");

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

  // ==================== 資源操作 ====================

  async refreshResources() {
    this.resources.backgrounds = await this.fs.listResources("backgrounds");
    this.resources.characters = await this.fs.listResources("characters");
    this.resources.bgm = await this.fs.listResources("bgm");
    this.resources.se = await this.fs.listResources("se");
    this.resources.voice = await this.fs.listResources("voice");
  }

  // 匯入資源檔（File/Blob），寫回資料夾並刷新清單
  async importAsset(kind, file) {
    const fileName = file.name || `asset_${Date.now()}`;
    await this.fs.writeResource(kind, fileName, file);
    await this.refreshResources();
    this.notify("resources-updated", { kind, fileName });
    return fileName;
  }

  async deleteAsset(kind, fileName) {
    await this.fs.deleteResource(kind, fileName);
    await this.refreshResources();
    this.notify("resources-updated", { kind, fileName, deleted: true });
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

  /**
   * 以完整的 { meta, instructions } 取代場景內容（供 Markdown/JSON 原始碼檢視套用）。
   * 與 updateSceneMeta 的差異：meta 是「整份取代」而非合併，故刪掉的欄位會真的消失。
   * 單一 undo 進入點，避免拆成兩次操作。
   * 注意：場景 id 一律沿用原本的（改 id 請走場景 header 的改名流程，才會連動 goto/next）。
   */
  replaceScene(sceneId, { meta, instructions }) {
    this.#pushUndo();
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    if (meta) sc.meta = { ...meta, id: sc.meta.id };
    if (Array.isArray(instructions)) sc.instructions = instructions;
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

  // ==================== 立繪位置預設 ====================
  // story.json 的 positions: { 名稱: { x, y, anchor, scale } }
  // 對應 S2d 的引擎規則：**沒宣告就沿用內建三格版面**，
  // 所以「恢復預設」等於移除宣告，不需要硬編一組假的預設值。

  getPositions() {
    return this.storyMeta?.positions || {};
  }

  upsertPosition(name, def) {
    this.#pushUndo();
    if (!this.storyMeta.positions) this.storyMeta.positions = {};
    this.storyMeta.positions[name] = { ...this.storyMeta.positions[name], ...def };
    this.notify("positions-updated", { name });
  }

  removePosition(name) {
    this.#pushUndo();
    if (this.storyMeta.positions) {
      delete this.storyMeta.positions[name];
      if (Object.keys(this.storyMeta.positions).length === 0) delete this.storyMeta.positions;
    }
    this.notify("positions-updated", { name, removed: true });
  }

  /** 劇本中實際用到的位置槽名稱（@show 的第二個參數） */
  collectUsedSlots() {
    const used = new Set();
    for (const sc of this.scenes.values()) {
      for (const ins of sc.instructions) {
        if (ins.type === "directive" && ins.name === "show") {
          const slot = (ins.args?.positional || [])[1];
          if (slot) used.add(slot);
        }
      }
    }
    return used;
  }

  // ==================== 資產引用追蹤 ====================

  /**
   * 找出某個資產檔被引用的所有位置。
   *
   * 注意「立繪」是間接引用：劇本的 @show 指的是**角色名**而非檔名，
   * 檔案是透過 story.json 的 characters[名].default / emotions[*] 才被用到。
   * 若照別的類型那樣去比對指令參數，會把所有立繪誤判成游離。
   *
   * @returns {Array<{sceneId?:string, index?:number, where?:string, detail:string}>}
   */
  findAssetUsages(kind, file) {
    const hits = [];

    if (kind === "characters") {
      for (const [name, data] of Object.entries(this.storyMeta?.characters || {})) {
        if (data?.default === file) {
          hits.push({ where: "story.json", detail: `角色「${name}」的預設立繪` });
        }
        for (const [emo, f] of Object.entries(data?.emotions || {})) {
          if (f === file) hits.push({ where: "story.json", detail: `角色「${name}」的表情「${emo}」` });
        }
      }
      return hits;
    }

    for (const [sceneId, sc] of this.scenes) {
      if (kind === "backgrounds" && sc.meta.background === file) {
        hits.push({ sceneId, index: null, detail: "場景 front matter 的背景" });
      }
      if (kind === "bgm" && sc.meta.bgm === file) {
        hits.push({ sceneId, index: null, detail: "場景 front matter 的 BGM" });
      }
      sc.instructions.forEach((ins, index) => {
        if (ins.type !== "directive") return;
        const p0 = (ins.args?.positional || [])[0];
        if (p0 !== file) return;
        if (kind === "backgrounds" && ins.name === "bg") hits.push({ sceneId, index, detail: "@bg" });
        if (kind === "bgm" && ins.name === "bgm") hits.push({ sceneId, index, detail: "@bgm" });
        if (kind === "se" && ins.name === "se") hits.push({ sceneId, index, detail: "@se" });
        if (kind === "voice" && ins.name === "voice") hits.push({ sceneId, index, detail: "@voice" });
      });
    }
    return hits;
  }

  /** 各類型中沒有任何引用的資產（游離） */
  findOrphanAssets() {
    const out = {};
    for (const kind of ["backgrounds", "characters", "bgm", "se", "voice"]) {
      out[kind] = (this.resources[kind] || []).filter(
        (f) => this.findAssetUsages(kind, f).length === 0
      );
    }
    return out;
  }

  /** 找出角色「名稱」被劇本引用的位置（@show/@hide/@move 與對話 speaker） */
  findCharacterUsages(name) {
    const hits = [];
    for (const [sceneId, sc] of this.scenes) {
      sc.instructions.forEach((ins, index) => {
        if (ins.type === "text" && ins.speaker) {
          // speaker 可能寫成「小鈴(心聲)」，取括號前比對
          const base = String(ins.speaker).replace(/[（(].*$/, "").trim();
          if (base === name) hits.push({ sceneId, index, detail: `對話：${ins.speaker}` });
          return;
        }
        if (ins.type !== "directive") return;
        if (!["show", "hide", "move"].includes(ins.name)) return;
        if ((ins.args?.positional || [])[0] === name) {
          hits.push({ sceneId, index, detail: `@${ins.name}` });
        }
      });
    }
    return hits;
  }

  // ==================== 章節（輕量分層）====================
  // story.json 的 chapters: [{ id, title, scenes: [sceneId...] }]
  // 場景檔與 DSL 完全不變；未列入任何章節的場景視為「未分類」。

  getChapters() {
    return this.storyMeta?.chapters || [];
  }

  upsertChapter(chapter) {
    this.#pushUndo();
    if (!this.storyMeta.chapters) this.storyMeta.chapters = [];
    const chapters = [...this.storyMeta.chapters];
    const i = chapters.findIndex((c) => c.id === chapter.id);
    if (i >= 0) chapters[i] = { ...chapters[i], ...chapter };
    else chapters.push({ id: chapter.id, title: chapter.title || chapter.id, scenes: chapter.scenes || [] });
    this.storyMeta.chapters = chapters;
    this.notify("chapters-updated", { id: chapter.id });
  }

  removeChapter(chapterId) {
    this.#pushUndo();
    this.storyMeta.chapters = this.getChapters().filter((c) => c.id !== chapterId);
    this.notify("chapters-updated", { id: chapterId, removed: true });
  }

  /** 場景所屬章節 id；未分類回 null */
  getSceneChapter(sceneId) {
    for (const c of this.getChapters()) {
      if ((c.scenes || []).includes(sceneId)) return c.id;
    }
    return null;
  }

  /** 設定場景所屬章節（chapterId 傳 null/"" 表示移出章節）。場景只會屬於一個章節。 */
  setSceneChapter(sceneId, chapterId) {
    this.#pushUndo();
    const chapters = this.getChapters().map((c) => ({
      ...c,
      scenes: (c.scenes || []).filter((s) => s !== sceneId),
    }));
    if (chapterId) {
      const target = chapters.find((c) => c.id === chapterId);
      if (target) target.scenes.push(sceneId);
    }
    this.storyMeta.chapters = chapters;
    this.notify("chapters-updated", { sceneId, chapterId });
  }

  // ==================== 旗標登記 ====================

  getDeclaredFlags() {
    return this.storyMeta?.flags || {};
  }

  upsertFlag(name, def) {
    this.#pushUndo();
    if (!this.storyMeta.flags) this.storyMeta.flags = {};
    this.storyMeta.flags[name] = def;
    this.notify("flags-updated", { name });
  }

  removeFlag(name) {
    this.#pushUndo();
    if (this.storyMeta.flags) delete this.storyMeta.flags[name];
    this.notify("flags-updated", { name, removed: true });
  }

  // 從條件式抽出旗標名（與 FlagInspector 規則一致）
  #extractConditionFlags(expr) {
    if (!expr) return [];
    const noStr = expr.replace(/"([^"\\]|\\.)*"/g, "").replace(/'([^'\\]|\\.)*'/g, "");
    const reserved = new Set(["true", "false", "null"]);
    const re = /([a-zA-Z_一-鿿㐀-䶿豈-﫿][\w一-鿿㐀-䶿豈-﫿]*)/g;
    const out = [];
    let m;
    while ((m = re.exec(noStr)) !== null) if (!reserved.has(m[1])) out.push(m[1]);
    return out;
  }

  // 劇本中實際用到的旗標名（@set / 選項 set / 條件式）
  collectUsedFlagNames() {
    const used = new Set();
    for (const sc of this.scenes.values()) {
      for (const ins of sc.instructions) {
        if (ins.type === "set" && ins.key) used.add(ins.key);
        if ((ins.type === "if" || ins.type === "elif") && ins.condition) {
          for (const f of this.#extractConditionFlags(ins.condition)) used.add(f);
        }
        if (ins.type === "choice") {
          for (const opt of ins.options) for (const k of Object.keys(opt.set || {})) used.add(k);
        }
      }
    }
    return used;
  }

  // 已登記 ∪ 已使用，供下拉選單與 Linter 用
  getKnownFlagNames() {
    const set = new Set(Object.keys(this.getDeclaredFlags()));
    for (const f of this.collectUsedFlagNames()) set.add(f);
    return [...set].sort((a, b) => a.localeCompare(b));
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
