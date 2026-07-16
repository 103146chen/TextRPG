// ============================================
// GameRuntime.js
// 遊戲執行期：把 StoryEngine 與 UI（文字框／立繪／背景／音訊／選項）接起來。
// 由 index.html 的正式遊玩與 preview.html 的即時預覽共用，避免兩邊邏輯漂移。
// ============================================

import { StoryEngine } from "../engine/StoryEngine.js";
import { TextBox } from "./TextBox.js";
import { ChoiceMenu } from "./ChoiceMenu.js";
import { CharacterLayer, BackgroundLayer } from "./CharacterLayer.js";
import { AudioManager } from "./AudioManager.js";
import { ScreenEffects } from "./ScreenEffects.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class GameRuntime {
  /**
   * @param {object} opts
   * @param {object} opts.dom - DOM 元素引用：
   *   { textContent, speakerName, textIndicator, choiceContainer, characterLayer, backgroundLayer }
   * @param {object} opts.storyMeta - 已載入的 story.json 物件
   * @param {string} [opts.storyPath] - 正式遊玩用的資源基底路徑
   * @param {function} [opts.sceneLoader] - 即時預覽：從記憶體讀 raw markdown
   * @param {function} [opts.metaLoader] - 即時預覽：從記憶體讀 storyMeta
   * @param {function} [opts.resolveAsset] - 即時預覽：(kind, file) => Promise<blobUrl>
   * @param {function} [opts.onEnding] - 走到結局後的回呼（宿主決定：回標題 / 顯示橫幅…）
   */
  constructor({ dom, storyMeta, storyPath, sceneLoader, metaLoader, resolveAsset, onEnding }) {
    this.dom = dom;
    this.storyMeta = storyMeta;
    this.onEndingCb = onEnding;
    this.instant = false;   // 靜態求值模式：不播動畫、不出聲、不等待

    this.textBox = new TextBox({
      contentEl: dom.textContent,
      speakerEl: dom.speakerName,
      indicatorEl: dom.textIndicator,
    });
    this.choiceMenu = new ChoiceMenu(dom.choiceContainer);
    this.characterLayer = new CharacterLayer(
      dom.characterLayer,
      storyPath,
      storyMeta.characters || {},
      resolveAsset,
      storyMeta.positions || null
    );
    this.backgroundLayer = new BackgroundLayer(dom.backgroundLayer, storyPath, resolveAsset);
    this.audio = new AudioManager(storyPath, resolveAsset);
    this.effects = dom.screen ? new ScreenEffects(dom.screen) : null;

    this.engine = new StoryEngine({
      storyPath,
      sceneLoader,
      metaLoader,
      onText: this.#handleText.bind(this),
      onChoice: this.#handleChoice.bind(this),
      onDirective: this.#handleDirective.bind(this),
      onSceneChange: this.#handleSceneChange.bind(this),
      onEnding: this.#handleEnding.bind(this),
    });
    this.engine.storyMeta = storyMeta;
  }

  // ---------- 對外委派 ----------
  get state() { return this.engine.state; }
  startNewGame() { return this.engine.startNewGame(); }
  startAtScene(sceneId, pc = 0) { return this.engine.startAtScene(sceneId, pc); }
  advance() { return this.engine.advance(); }
  rollback() { return this.engine.rollback(); }
  canRollback() { return this.engine.canRollback(); }
  serialize() { return this.engine.serialize(); }
  loadState(data) { return this.engine.loadState(data); }
  getPreviewText() { return this.textBox.getPreview(); }

  /**
   * 點擊或按鍵時前進：先讓打字機完成或推進到下一句。
   * @returns {boolean} 是否有處理（供宿主判斷是否要 preventDefault）
   */
  handleAdvanceInput() {
    if (this.textBox.handleClick()) {
      setTimeout(() => this.engine.advance(), 0);
      return true;
    }
    return false;
  }

  /**
   * 切換靜態求值模式。指令語意不變，只把「呈現」變成瞬間完成：
   * 時長歸零、關閉 CSS 轉場、靜音、跳過 wait 與瞬時特效。
   */
  setInstant(on) {
    this.instant = !!on;
    this.dom.characterLayer?.classList.toggle("instant", this.instant);
    this.dom.backgroundLayer?.classList.toggle("instant", this.instant);
    this.audio.setMuted(this.instant);
  }

  /** 依模式決定時長：靜態求值時一律 0 */
  #d(ms) { return this.instant ? 0 : ms; }

  /** 靜態求值到第 pc 條指令（畫面停在該點，不播放） */
  evaluateTo(sceneId, pc) { return this.engine.evaluateTo(sceneId, pc); }

  /** 停止環境效果（離開遊戲畫面時呼叫） */
  stopAmbient() {
    this.audio.stopBgm(500);
    this.audio.stopVoice();
    this.characterLayer.hideAll(300);
  }

  // ---------- 引擎回呼 ----------
  async #handleText(speaker, text) {
    if (speaker) this.characterLayer.setSpeaking(speaker);
    else this.characterLayer.clearSpeaking();
    if (this.instant) { this.textBox.showInstant(speaker, text); return; }
    await this.textBox.showText(speaker, text);
  }

  async #handleChoice(options) {
    if (this.instant) { this.choiceMenu.showStatic(options); return; }
    const idx = await this.choiceMenu.show(options);
    this.engine.selectChoice(idx);
  }

  async #handleDirective(ins) {
    const { name, args } = ins;
    switch (name) {
      case "bg": {
        await this.backgroundLayer.change(args.positional[0], this.#d(args.fade ?? 800));
        break;
      }
      case "show": {
        // slot 是身分鍵（同 slot 再 show 會取代前一個角色）；
        // pos / anchor / scale 為可選的渲染覆寫（未給則沿用 CSS 三格版面）
        const [charName, slot = "center", emotion = null] = args.positional;
        await this.characterLayer.show(charName, slot, emotion, {
          pos: args.pos,
          anchor: args.anchor,
          scale: args.scale,
        });
        break;
      }
      case "hide": {
        const charName = args.positional[0];
        if (charName === "all") await this.characterLayer.hideAll(this.#d(args.fade ?? 400));
        else await this.characterLayer.hide(charName, this.#d(args.fade ?? 400));
        break;
      }
      case "move": {
        // @move alice center→left
        const [charName, movement] = args.positional;
        const [, to] = movement.split(/[→\->]/).map((x) => x.trim());
        const cur = Object.entries(this.characterLayer.current).find(
          ([, v]) => v?.charName === charName
        );
        if (cur) {
          const emotion = cur[1].emotion;
          await this.characterLayer.hide(charName, 200);
          await this.characterLayer.show(charName, to, emotion);
        }
        break;
      }
      case "bgm": {
        if (this.instant) break;                       // 靜態求值不出聲
        await this.audio.playBgm(args.positional[0], { fadeIn: args.fade ?? 1000 });
        break;
      }
      case "bgm-stop":
      case "stopbgm": {
        if (this.instant) break;
        await this.audio.stopBgm(args.fade ?? 500);
        break;
      }
      case "se": {
        if (this.instant) break;
        this.audio.playSe(args.positional[0]);
        break;
      }
      case "voice": {
        // 對話配音：放在對話行前，唸該句時播放；新語音自動停掉前一句
        if (this.instant) break;                       // 靜態求值不出聲
        this.audio.playVoice(args.positional[0]);
        break;
      }
      case "wait": {
        if (this.instant) break;                       // 靜態求值不等待
        await wait(parseInt(args.positional[0] || "500", 10));
        break;
      }
      case "shake": {
        if (this.instant) break;                       // 瞬時特效在靜態求值中無意義
        if (this.effects) {
          const intensity = Number(args.positional[0]) || Number(args.intensity) || 8;
          const duration = args.duration ?? args.fade ?? 500;
          await this.effects.shake({ intensity, duration });
        }
        break;
      }
      case "flash": {
        if (this.instant) break;
        if (this.effects) {
          const color = args.color || args.positional[0] || "#ffffff";
          const duration = args.duration ?? args.fade ?? 400;
          await this.effects.flash({ color, duration });
        }
        break;
      }
      case "tint": {
        // 染色是「持續狀態」，靜態求值要保留，只是瞬間套用
        if (this.effects) {
          const color = args.color || args.positional[0] || "#000000";
          const opacity = args.opacity != null ? Number(args.opacity) : 0.4;
          const duration = this.#d(args.duration ?? args.fade ?? 600);
          this.effects.tint({ color, opacity, duration });
        }
        break;
      }
      case "tint-clear":
      case "cleartint": {
        if (this.effects) this.effects.clearTint({ duration: this.#d(args.duration ?? args.fade ?? 600) });
        break;
      }
      default:
        console.warn("未知指令:", name, args);
    }
  }

  async #handleSceneChange(sceneMeta) {
    if (sceneMeta.background) await this.backgroundLayer.change(sceneMeta.background, this.#d(600));
    if (sceneMeta.bgm && !this.instant) await this.audio.playBgm(sceneMeta.bgm, { fadeIn: 800 });
  }

  async #handleEnding(endingIns) {
    if (this.instant) {
      this.textBox.showInstant("", `—— 結局：${endingIns.title} ——`);
      return;
    }
    await wait(500);
    await this.textBox.showText("", `—— 結局：${endingIns.title} ——`);
    await wait(1500);
    await this.textBox.showText("", endingIns.desc || "你的故事走到了這裡。");
    await wait(2000);
    if (this.onEndingCb) this.onEndingCb(endingIns);
  }
}
