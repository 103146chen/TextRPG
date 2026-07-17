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
      video: [],
    };
    this.listeners = new Set();      // 變更訂閱者（給 UI 重繪用）
    this.metaDirty = false;          // story.json 類變更（角色/旗標/章節/位置/基本資訊）
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
    this.resources.video = await this.fs.listResources("video");

    this.undoStack = [];
    this.redoStack = [];
    this.metaDirty = false;
    this.notify("loaded");
  }

  // ==================== 儲存 ====================

  async saveAll() {
    // 儲存被改過的場景。
    // 重要：dirty 要在 await 寫檔「之前」清掉——寫入期間使用者若繼續編輯，
    // markDirty 會重新標髒、留給下一輪儲存；若寫完才清，會把新編輯的
    // 髒旗標一併蓋掉，該段編輯就永遠不會被存（自動存檔下機率性觸發）。
    for (const [sceneId, sc] of this.scenes) {
      if (!sc.dirty) continue;
      const md = MarkdownWriter.write({ meta: sc.meta, instructions: sc.instructions });
      sc.dirty = false;
      try {
        await this.fs.writeScene(sc.fileName, md);
        sc.raw = md;
      } catch (err) {
        sc.dirty = true;   // 寫失敗要保住旗標，否則變更被標成已存
        throw err;
      }
    }
    this.metaDirty = false;
    try {
      await this.fs.writeStoryJson(this.storyMeta);
    } catch (err) {
      this.metaDirty = true;
      throw err;
    }
    this.notify("saved");
  }

  async saveScene(sceneId) {
    const sc = this.scenes.get(sceneId);
    if (!sc) return;
    const md = MarkdownWriter.write({ meta: sc.meta, instructions: sc.instructions });
    sc.dirty = false;   // 先清（同 saveAll 的競態說明）
    try {
      await this.fs.writeScene(sc.fileName, md);
      sc.raw = md;
    } catch (err) {
      sc.dirty = true;
      throw err;
    }
    this.notify("scene-saved", { sceneId });
  }

  hasUnsavedChanges() {
    if (this.metaDirty) return true;
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
    this.resources.video = await this.fs.listResources("video");
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
    this.metaDirty = true;
    if (!this.storyMeta.positions) this.storyMeta.positions = {};
    this.storyMeta.positions[name] = { ...this.storyMeta.positions[name], ...def };
    this.notify("positions-updated", { name });
  }

  removePosition(name) {
    this.#pushUndo();
    this.metaDirty = true;
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
        if (kind === "video" && ins.name === "video") hits.push({ sceneId, index, detail: "@video" });
      });
    }
    return hits;
  }

  /**
   * 全域搜尋（S7）：跨場景找台詞/角色/選項/變量/條件/資產檔名/標籤/結局。
   * 回傳 { sceneId, index, kind, snippet }；index 為 null 代表命中場景本身。
   */
  searchAll(query, { limit = 200 } = {}) {
    const q = String(query).trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    const push = (sceneId, index, kind, snippet) => {
      if (hits.length < limit) hits.push({ sceneId, index, kind, snippet: String(snippet) });
    };
    const m = (v) => String(v ?? "").toLowerCase().includes(q);

    for (const sceneId of this.getAllSceneIds()) {
      if (hits.length >= limit) break;
      const sc = this.getScene(sceneId);
      if (m(sceneId) || m(sc.meta.title)) push(sceneId, null, "場景", sc.meta.title || sceneId);

      sc.instructions.forEach((ins, idx) => {
        switch (ins.type) {
          case "text":
            if (m(ins.text) || m(ins.speaker)) {
              push(sceneId, idx, ins.speaker ? "台詞" : "旁白",
                   `${ins.speaker ? ins.speaker + ": " : ""}${ins.text}`);
            }
            break;
          case "choice":
            for (const opt of ins.options) {
              if (m(opt.text) || m(opt.goto)) { push(sceneId, idx, "選項", opt.text); break; }
            }
            break;
          case "set":
            if (m(ins.key) || m(ins.value)) push(sceneId, idx, "變量", `@set ${ins.key} ${ins.op} ${ins.value}`);
            break;
          case "if":
          case "elif":
            if (m(ins.condition)) push(sceneId, idx, "條件", `${ins.type} ${ins.condition}`);
            break;
          case "goto":
            if (m(ins.target)) push(sceneId, idx, "跳轉", `@goto ${ins.target}`);
            break;
          case "label":
            if (m(ins.name)) push(sceneId, idx, "標籤", ins.name);
            break;
          case "ending":
            if (m(ins.id) || m(ins.title) || m(ins.desc)) push(sceneId, idx, "結局", ins.title || ins.id);
            break;
          case "directive": {
            const args = ins.args || {};
            const argStr = [
              ...(args.positional || []),
              ...Object.entries(args).filter(([k]) => k !== "positional").map(([k, v]) => `${k}=${v}`),
            ].join(" ");
            if (m(ins.name) || m(argStr)) push(sceneId, idx, "指令", `@${ins.name} ${argStr}`.trim());
            break;
          }
        }
      });
    }
    return hits;
  }

  /** 各類型中沒有任何引用的資產（游離） */
  findOrphanAssets() {
    const out = {};
    for (const kind of ["backgrounds", "characters", "bgm", "se", "voice", "video"]) {
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
    this.metaDirty = true;
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
    this.metaDirty = true;
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
    this.metaDirty = true;
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

  /**
   * 把場景移到某章節的指定位置（指派 + 排序合一）。
   * chapterId 為 null/"" → 移出章節（未分類）；index < 0 或超界 → 放到末端。
   * 同章節內移動可用來重排；跨章節移動同時處理搬離來源。
   */
  moveScene(sceneId, chapterId, index = -1) {
    this.#pushUndo();
    this.metaDirty = true;
    const chapters = this.getChapters().map((c) => ({
      ...c,
      scenes: (c.scenes || []).filter((s) => s !== sceneId),
    }));
    if (chapterId) {
      const target = chapters.find((c) => c.id === chapterId);
      if (target) {
        if (index < 0 || index > target.scenes.length) target.scenes.push(sceneId);
        else target.scenes.splice(index, 0, sceneId);
      }
    }
    this.storyMeta.chapters = chapters;
    this.notify("chapters-updated", { sceneId, chapterId, index });
  }

  /** 調整章節順序：dir = -1 上移、+1 下移 */
  moveChapter(chapterId, dir) {
    const chapters = [...this.getChapters()];
    const i = chapters.findIndex((c) => c.id === chapterId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= chapters.length) return;
    this.#pushUndo();
    this.metaDirty = true;
    [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
    this.storyMeta.chapters = chapters;
    this.notify("chapters-updated", { chapterId, moved: dir });
  }

  // ==================== 旗標登記 ====================

  getDeclaredFlags() {
    return this.storyMeta?.flags || {};
  }

  upsertFlag(name, def) {
    this.#pushUndo();
    this.metaDirty = true;
    if (!this.storyMeta.flags) this.storyMeta.flags = {};
    this.storyMeta.flags[name] = def;
    this.notify("flags-updated", { name });
  }

  removeFlag(name) {
    this.#pushUndo();
    this.metaDirty = true;
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
    this.metaDirty = true;
    this.storyMeta = { ...this.storyMeta, ...patch };
    this.notify("story-meta-updated");
  }

  upsertCharacter(name, data) {
    this.#pushUndo();
    this.metaDirty = true;
    if (!this.storyMeta.characters) this.storyMeta.characters = {};
    this.storyMeta.characters[name] = data;
    this.notify("characters-updated");
  }

  removeCharacter(name) {
    this.#pushUndo();
    this.metaDirty = true;
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
    // 快照裡的 dirty/raw 是「當時」的狀態；若快照之後存過檔，
    // 直接還原會把「與磁碟不同的內容」標成已存而漏寫。
    // 以目前的 raw（每次寫檔後更新，即磁碟真相）重新判定 dirty。
    const diskRaw = new Map();
    for (const [id, sc] of this.scenes) diskRaw.set(id, sc.raw);

    this.storyMeta = snapshot.storyMeta;
    this.scenes = new Map(snapshot.scenes);

    for (const [id, sc] of this.scenes) {
      if (diskRaw.has(id)) {
        sc.raw = diskRaw.get(id);
        const md = MarkdownWriter.write({ meta: sc.meta, instructions: sc.instructions });
        sc.dirty = sc.raw == null || md !== sc.raw;
      } else {
        // 磁碟上目前不存在（例如剛刪除又 undo 回來）→ 必須重寫
        sc.raw = null;
        sc.dirty = true;
      }
    }
    this.metaDirty = true;   // storyMeta 也可能被還原成與磁碟不同，保守標髒
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
