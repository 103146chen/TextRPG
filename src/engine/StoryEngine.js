// ============================================
// StoryEngine.js
// 核心引擎：載入劇本、推進指令、處理狀態
// ============================================

import { SceneParser } from "./SceneParser.js";
import { ConditionEvaluator } from "./ConditionEvaluator.js";

export class StoryEngine {
  constructor({ storyPath, onText, onChoice, onDirective, onEnding, onSceneChange, sceneLoader, metaLoader }) {
    this.storyPath = storyPath;         // e.g. "./public/stories/demo_story"
    this.sceneLoader = sceneLoader;     // 可選：(sceneId) => Promise<string raw md>，供即時預覽從記憶體讀取
    this.metaLoader = metaLoader;       // 可選：() => Promise<storyMeta>
    this.onText = onText;                // (speaker, text, state, emotion, voice) => void
    this.onChoice = onChoice;            // (options) => void
    this.onDirective = onDirective;      // (directive, state) => Promise
    this.onEnding = onEnding;            // (endingData) => void
    this.onSceneChange = onSceneChange;  // (sceneMeta) => void

    this.storyMeta = null;
    this.sceneCache = new Map();         // sceneId -> {meta, instructions}
    this.state = this.#createFreshState();
    this.history = [];                   // 回溯堆疊
    this.maxHistory = 80;
    this.running = false;
  }

  #createFreshState() {
    return {
      sceneId: null,
      pc: 0,                     // program counter
      flags: {},
      waitingForChoice: false,
      finished: false,
      _branchStack: [],          // 追蹤巢狀 if/elif/else 狀態
      _callStack: [],            // 選項 do: 進入具名區塊時的返回位址
    };
  }

  // 依 story.json 的 flags 宣告產生開場預設變數值（未宣告則為空，向後相容）
  #initialFlags() {
    const flags = {};
    const decls = this.storyMeta?.flags || {};
    for (const [name, def] of Object.entries(decls)) {
      if (def && "default" in def) flags[name] = def.default;
      else if (def?.type === "number") flags[name] = 0;
      else if (def?.type === "boolean") flags[name] = false;
      else flags[name] = "";
    }
    return flags;
  }

  // ============ 載入 ============

  async loadStoryMeta() {
    if (this.metaLoader) {
      this.storyMeta = await this.metaLoader();
      return this.storyMeta;
    }
    const res = await fetch(`${this.storyPath}/story.json`);
    if (!res.ok) throw new Error(`無法載入 story.json: ${res.status}`);
    this.storyMeta = await res.json();
    return this.storyMeta;
  }

  async loadScene(sceneId) {
    if (this.sceneCache.has(sceneId)) return this.sceneCache.get(sceneId);
    let raw;
    if (this.sceneLoader) {
      raw = await this.sceneLoader(sceneId);
      if (raw == null) throw new Error(`無法載入場景 ${sceneId}`);
    } else {
      const res = await fetch(`${this.storyPath}/scenes/${sceneId}.md`);
      if (!res.ok) throw new Error(`無法載入場景 ${sceneId}: ${res.status}`);
      raw = await res.text();
    }
    const parsed = SceneParser.parse(raw, { characters: this.storyMeta?.characters || null });
    parsed.raw = raw;                    // 保留原文供存檔雜湊比對
    this.sceneCache.set(sceneId, parsed);
    return parsed;
  }

  // 清空場景快取（即時預覽重載時使用，確保讀到最新的記憶體內容）
  clearSceneCache() {
    this.sceneCache.clear();
  }

  // ============ 場景切換 ============

  async startNewGame() {
    this.state = this.#createFreshState();
    this.state.flags = this.#initialFlags();
    this.history = [];
    await this.gotoScene(this.storyMeta.start);
  }

  /**
   * 靜態求值到第 targetPc 條指令：一路執行到該點，不暫停等待玩家。
   *
   * 重要：刻意與正式遊玩共用同一份 #executeInstruction，避免預覽與實際遊玩語意漂移。
   * 「不播動畫／不出聲／不等待」不在這裡處理，而是由宿主（GameRuntime.setInstant）
   * 把時長歸零、跳過音效與 wait —— 指令的「意義」始終只有一份。
   *
   * @returns {{reached:boolean, stoppedAt:string, steps:number}}
   *   stoppedAt: "target" | "choice" | "ended" | "scene-changed" | "end-of-scene" | "max-steps"
   */
  async evaluateTo(sceneId, targetPc, { maxSteps = 5000 } = {}) {
    this.evaluating = true;      // 求值期間禁止一切副作用（見 #unlockEnding）
    try {
      return await this.#evaluateToInner(sceneId, targetPc, maxSteps);
    } finally {
      this.evaluating = false;
    }
  }

  async #evaluateToInner(sceneId, targetPc, maxSteps) {
    this.state = this.#createFreshState();
    this.state.flags = this.#initialFlags();
    this.history = [];
    const scene = await this.loadScene(sceneId);
    this.state.sceneId = sceneId;
    this.state.pc = 0;
    if (this.onSceneChange) {
      await this.onSceneChange(scene.meta);
    }
    this.running = true;

    let steps = 0;
    let stoppedAt = "target";
    while (this.state.pc <= targetPc) {
      if (this.state.pc >= scene.instructions.length) { stoppedAt = "end-of-scene"; break; }
      // goto 可能往回跳，用步數上限防止無限迴圈
      if (++steps > maxSteps) { stoppedAt = "max-steps"; break; }

      const ins = scene.instructions[this.state.pc];
      const action = await this.#executeInstruction(ins, scene);

      if (action === "jumped") continue;                 // pc 已被 goto/if 改過
      if (action === "scene-changed") { stoppedAt = "scene-changed"; break; }
      if (action === "ended") { stoppedAt = "ended"; break; }
      if (action === "wait-choice") { stoppedAt = "choice"; break; }
      this.state.pc++;
    }
    return { reached: stoppedAt === "target", stoppedAt, steps };
  }

  // 從指定場景與指令位置開始（供即時預覽「從這行試玩」；flags 從空白起算）
  async startAtScene(sceneId, pc = 0) {
    this.state = this.#createFreshState();
    this.state.flags = this.#initialFlags();
    this.history = [];
    const scene = await this.loadScene(sceneId);
    this.state.sceneId = sceneId;
    this.state.pc = Math.max(0, Math.min(pc, scene.instructions.length));
    if (this.onSceneChange) {
      await this.onSceneChange(scene.meta);
    }
    this.running = true;
    await this.step();
  }

  async gotoScene(sceneId) {
    const scene = await this.loadScene(sceneId);
    this.state.sceneId = sceneId;
    this.state.pc = 0;
    this.state.waitingForChoice = false;
    this.state._callStack = [];   // 換場景後，本場景的區塊返回位址已無意義

    // 應用場景 front matter 的畫面指令
    if (this.onSceneChange) {
      await this.onSceneChange(scene.meta);
    }

    this.running = true;
    await this.step();
  }

  /**
   * 推進到下一個「需要玩家互動」的點（文字顯示完、選項出現、結局）
   */
  async step() {
    const scene = this.sceneCache.get(this.state.sceneId);
    if (!scene) return;

    while (this.state.pc < scene.instructions.length) {
      const ins = scene.instructions[this.state.pc];
      const action = await this.#executeInstruction(ins, scene);

      if (action === "pause") {
        // 等待玩家點擊繼續
        this.state.pc++;
        return;
      }
      if (action === "wait-choice") {
        // 選項顯示中，不推進 pc（等 selectChoice 呼叫）
        return;
      }
      if (action === "jumped") {
        // pc 已被 goto/if 改過，不要加 1
        continue;
      }
      if (action === "scene-changed") {
        // 已跳到其他場景，中斷這個 loop
        return;
      }
      if (action === "ended") {
        return;
      }

      this.state.pc++;
    }

    // 場景指令用盡，若 front matter 有 next 就繼續
    if (scene.meta.next) {
      await this.gotoScene(scene.meta.next);
    }
  }

  async #executeInstruction(ins, scene) {
    switch (ins.type) {
      case "text": {
        // 保存 snapshot 供回溯
        this.#pushHistory();
        await this.onText(ins.speaker, ins.text, this.state, ins.emotion || null, ins.voice || null);
        return "pause";
      }

      case "directive": {
        if (this.onDirective) {
          await this.onDirective(ins, this.state);
        }
        return "continue";
      }

      case "set": {
        this.#applySet(ins);
        return "continue";
      }

      case "if": {
        const passed = ConditionEvaluator.eval(ins.condition, this.state.flags);
        if (!this.state._branchStack) this.state._branchStack = [];
        if (passed) {
          this.state._branchStack.push({ endIndex: ins.endIndex, taken: true });
          return "continue";
        } else {
          this.state._branchStack.push({ endIndex: ins.endIndex, taken: false });
          const branches = ins.branches;
          const myIdx = branches.findIndex(b => b.index === this.state.pc);
          const next = branches[myIdx + 1];
          if (next) {
            this.state.pc = next.index;
            return "jumped";
          } else {
            this.state.pc = ins.endIndex;
            return "jumped";
          }
        }
      }

      case "elif": {
        const stack = this.state._branchStack || [];
        const top = stack[stack.length - 1];
        if (top && top.taken) {
          // 前面已通過某個分支，跳到 endif
          this.state.pc = ins.endIndex;
          return "jumped";
        }
        const passed = ConditionEvaluator.eval(ins.condition, this.state.flags);
        if (passed) {
          if (top) top.taken = true;
          return "continue";
        } else {
          const branches = ins.branches;
          const myIdx = branches.findIndex(b => b.index === this.state.pc);
          const next = branches[myIdx + 1];
          if (next) {
            this.state.pc = next.index;
            return "jumped";
          } else {
            this.state.pc = ins.endIndex;
            return "jumped";
          }
        }
      }

      case "else": {
        const stack = this.state._branchStack || [];
        const top = stack[stack.length - 1];
        if (top && top.taken) {
          this.state.pc = ins.endIndex;
          return "jumped";
        }
        if (top) top.taken = true;
        return "continue";
      }

      case "endif": {
        if (this.state._branchStack) this.state._branchStack.pop();
        return "continue";
      }

      case "label": {
        // 純標記，無作用
        return "continue";
      }

      case "block": {
        // 具名區塊只有被選項的 do: 呼叫時才執行。線性跑到這裡代表是「主線
        // 走完後撞到檔尾的區塊定義區」，整段跳過，不然玩家會看到所有分支
        // 的內容全部依序播一遍。
        this.state.pc = (ins.endIndex ?? scene.instructions.length) + 1;
        return "jumped";
      }

      case "endblock": {
        const frame = (this.state._callStack || []).pop();
        // 沒有返回位址：不是被呼叫進來的（例如 goto 直接跳進區塊中間），
        // 當成普通標記往下走，不要亂跳。
        if (!frame) return "continue";

        // 區塊裡的 goto 會清空呼叫堆疊，所以正常情況下 frame 一定是本場景。
        // 真的對不上就放棄這個返回位址，繼續往下，避免跳到別的場景的錯誤位置。
        if (frame.sceneId !== this.state.sceneId) return "continue";

        // 選項同時寫了 do: 和 goto:：先跑完區塊，再照 goto 跳走（不返回）
        if (frame.goto) {
          await this.#handleGoto(frame.goto, scene);
          return this.state.sceneId === scene.meta.id ? "jumped" : "scene-changed";
        }

        this.state.pc = frame.pc;
        return "jumped";
      }

      case "goto": {
        await this.#handleGoto(ins.target, scene);
        return this.state.sceneId === scene.meta.id ? "jumped" : "scene-changed";
      }

      case "choice": {
        // 條件選項：只顯示符合條件者。全部都不符合時直接略過整個選項節點，
        // 否則畫面會停在一個沒有任何按鈕的選單上，玩家卡死。
        const visible = this.#visibleOptions(ins);
        if (visible.length === 0) break;
        this.state.waitingForChoice = true;
        await this.onChoice(visible);
        return "wait-choice";
      }

      case "ending": {
        // 靜態求值（編輯器預覽）不可污染玩家的結局圖鑑
        if (!this.evaluating) this.#unlockEnding(ins);
        if (this.onEnding) {
          await this.onEnding(ins);
        }
        this.state.finished = true;
        return "ended";
      }

      default:
        return "continue";
    }
  }

  #applySet(ins) {
    this.#writeFlag(ins.key, ins.op, ins.value);
  }

  // 統一的變數寫入：op 為 "=" / "+=" / "-="
  #writeFlag(key, op, value) {
    const cur = this.state.flags[key];
    switch (op) {
      case "+=":
        this.state.flags[key] = (cur ?? 0) + value;
        break;
      case "-=":
        this.state.flags[key] = (cur ?? 0) - value;
        break;
      case "=":
      default:
        this.state.flags[key] = value;
    }
  }

  // 套用選項 set 的單一項目：純值視為賦值，{ op, value } 視為增量
  #applyOpValue(key, val) {
    if (val && typeof val === "object" && "op" in val) {
      this.#writeFlag(key, val.op, val.value);
    } else {
      this.#writeFlag(key, "=", val);
    }
  }

  /**
   * goto 可以是「同場景的 label」或「別的場景 id」
   */
  async #handleGoto(target, scene) {
    // goto 是「跳走，不回來」：清掉待返回的區塊位址。否則區塊裡 goto 出去之後，
    // 之後任何一個 endblock 都會把玩家拉回一個早就不相干的位置。
    this.state._callStack = [];

    // 先找場景內的 label
    const labelIdx = scene.instructions.findIndex(
      x => x.type === "label" && x.name === target
    );
    if (labelIdx >= 0) {
      this.state.pc = labelIdx + 1;
      return;
    }
    // 否則當成場景 id
    await this.gotoScene(target);
  }

  // ============ 玩家互動 ============

  /**
   * 目前條件下實際會顯示的選項。沒寫 if 的選項一律顯示（既有劇本行為不變）。
   * 顯示與選取都必須走這支，兩邊的索引才會一致。
   */
  #visibleOptions(choiceIns) {
    return (choiceIns.options || []).filter(
      (o) => !o.if || ConditionEvaluator.eval(o.if, this.state.flags)
    );
  }

  /**
   * 玩家選擇選項後呼叫
   */
  async selectChoice(optionIndex) {
    const scene = this.sceneCache.get(this.state.sceneId);
    const choiceIns = scene.instructions[this.state.pc];
    if (choiceIns?.type !== "choice") return;

    this.#pushHistory(); // 選擇也入歷史

    // 傳進來的是「畫面上第幾個」，條件選項過濾後與原陣列索引不一致，
    // 必須用同一份可見清單取回選項，否則會套用到別的選項。
    // 這裡重算而非記錄狀態：重算不受存讀檔影響，且等待輸入期間變數不會變。
    const opt = this.#visibleOptions(choiceIns)[optionIndex];
    if (!opt) return;

    // 套用選項的 set：{ flag: true } 為賦值，{ charm: += 1 } 為增量
    for (const [key, val] of Object.entries(opt.set || {})) {
      this.#applyOpValue(key, val);
    }

    this.state.waitingForChoice = false;
    this.state.pc++; // 跳過 choice 指令本身

    // do:：先跑選項自己的內容區塊，跑完回到這裡（也就是選項節點的下一句）。
    // 同時有 goto: 時把它記在返回位址裡，等區塊跑完再跳走。
    const blockIdx = opt.do
      ? scene.instructions.findIndex((x) => x.type === "block" && x.name === opt.do)
      : -1;
    if (blockIdx >= 0) {
      if (!this.state._callStack) this.state._callStack = [];
      this.state._callStack.push({
        sceneId: this.state.sceneId,
        pc: this.state.pc,
        goto: opt.goto || null,
      });
      this.state.pc = blockIdx + 1;
    } else if (opt.goto) {
      // 沒有區塊（或找不到同名區塊）就維持原本的行為：直接跳
      await this.#handleGoto(opt.goto, scene);
    }
    await this.step();
  }

  /**
   * 玩家點擊繼續（顯示下一句）
   */
  async advance() {
    if (this.state.waitingForChoice || this.state.finished || !this.running) return;
    if (this._advancing) return;  // 防止重入
    this._advancing = true;
    try {
      await this.step();
    } finally {
      this._advancing = false;
    }
  }

  // ============ 回溯 ============

  #pushHistory() {
    this.history.push({
      sceneId: this.state.sceneId,
      pc: this.state.pc,
      flags: { ...this.state.flags },
      branchStack: JSON.parse(JSON.stringify(this.state._branchStack || [])),
      callStack: JSON.parse(JSON.stringify(this.state._callStack || [])),
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  canRollback() {
    return this.history.length > 1;
  }

  /**
   * 回溯到前一個 snapshot
   */
  async rollback() {
    if (this.history.length < 2) return false;
    this.history.pop(); // 移除當前
    const prev = this.history.pop(); // 拿前一個

    // 切換場景（如果不同）
    if (prev.sceneId !== this.state.sceneId) {
      const scene = await this.loadScene(prev.sceneId);
      this.state.sceneId = prev.sceneId;
      if (this.onSceneChange) {
        await this.onSceneChange(scene.meta);
      }
    }
    this.state.pc = prev.pc;
    this.state.flags = { ...prev.flags };
    this.state._branchStack = JSON.parse(JSON.stringify(prev.branchStack || []));
    this.state._callStack = JSON.parse(JSON.stringify(prev.callStack || []));
    this.state.waitingForChoice = false;

    await this.step();
    return true;
  }

  // ============ 存讀檔 ============

  serialize() {
    const scene = this.sceneCache.get(this.state.sceneId);
    return {
      storyId: this.storyMeta?.id || "unknown",
      sceneId: this.state.sceneId,
      pc: this.state.pc,
      flags: { ...this.state.flags },
      branchStack: JSON.parse(JSON.stringify(this.state._branchStack || [])),
      callStack: JSON.parse(JSON.stringify(this.state._callStack || [])),
      sceneHash: scene?.raw != null ? StoryEngine.#hashString(scene.raw) : null,
      timestamp: Date.now(),
    };
  }

  async loadState(saveData) {
    this.state = this.#createFreshState();
    this.history = [];
    this.state.flags = { ...this.#initialFlags(), ...saveData.flags };
    const scene = await this.loadScene(saveData.sceneId);
    this.state.sceneId = saveData.sceneId;

    // 預設精確還原（含分支堆疊，避免載入 if 區塊內時誤觸 else/elif）
    let pc = saveData.pc ?? 0;
    let branchStack = Array.isArray(saveData.branchStack)
      ? JSON.parse(JSON.stringify(saveData.branchStack))
      : [];
    // 舊存檔沒有 callStack（存檔當下還沒有區塊功能）→ 空陣列，行為與以前一致
    let callStack = Array.isArray(saveData.callStack)
      ? JSON.parse(JSON.stringify(saveData.callStack))
      : [];
    let stale = false;

    // 存檔含場景雜湊且與目前劇本不符 → 場景被改過，索引可能錯位
    if (saveData.sceneHash != null && scene.raw != null) {
      const curHash = StoryEngine.#hashString(scene.raw);
      if (curHash !== saveData.sceneHash) {
        stale = true;
        // 保守復原：夾在有效範圍內並清空分支堆疊，避免落在無效指令或分支不一致
        pc = Math.max(0, Math.min(pc, scene.instructions.length));
        branchStack = [];
        // 返回位址是指令索引，劇本改過後會指到別的地方，寧可不返回也不要跳錯
        callStack = [];
      }
    }

    this.state.pc = pc;
    this.state._branchStack = branchStack;
    this.state._callStack = callStack;

    if (this.onSceneChange) {
      await this.onSceneChange(scene.meta);
    }
    this.running = true;
    await this.step();
    return { stale };
  }

  // ============ 結局圖鑑 ============

  #unlockEnding(endingIns) {
    if (typeof localStorage === "undefined") return;   // 非瀏覽器環境（測試/工具）
    try {
      const key = `galgame.endings.${this.storyMeta.id}`;
      const unlocked = JSON.parse(localStorage.getItem(key) || "{}");
      // 標題以 story.json 的 endings 註冊表為準（唯一真相），指令自帶的僅作後備
      const reg = (this.storyMeta?.endings || []).find((e) => e.id === endingIns.id);
      unlocked[endingIns.id] = {
        title: reg?.title || endingIns.title || endingIns.id,
        unlockedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(unlocked));
    } catch (e) {
      console.warn("結局圖鑑寫入失敗", e);
    }
  }

  // 場景內容雜湊（FNV-1a 32-bit），偵測存檔後劇本是否被修改
  static #hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  static getUnlockedEndings(storyId) {
    const key = `galgame.endings.${storyId}`;
    return JSON.parse(localStorage.getItem(key) || "{}");
  }
}
