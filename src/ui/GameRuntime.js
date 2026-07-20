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
import { ParticleLayer } from "./ParticleLayer.js";

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
    this.storyPath = storyPath;
    this.resolveAsset = resolveAsset || null;
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
      storyMeta.positions || null,
      storyMeta.spriteAdjust || null
    );
    this.backgroundLayer = new BackgroundLayer(dom.backgroundLayer, storyPath, resolveAsset);
    this.audio = new AudioManager(storyPath, resolveAsset);
    this.effects = dom.screen ? new ScreenEffects(dom.screen) : null;
    this.uiHidden = false;
    dom.screen?.classList.remove("ui-hidden");   // 預覽重建 runtime 時清掉殘留

    dom.screen?.querySelectorAll(".float-text").forEach((el) => el.remove());   // 殘留浮動文字
    dom.screen?.querySelectorAll(".fx-video").forEach((el) => el.remove());      // 殘留視頻層
    this._videoEl = null;
    this._lineVoice = false;   // 目前語音是否來自「行內屬性」（換行要收掉）
    this.particles = dom.screen ? new ParticleLayer(dom.screen) : null;

    // 自動播放（@auto）：打字完成後等 autoDelay 毫秒自動前進
    this.autoPlay = false;
    this.autoDelay = 1500;
    this._autoTimer = null;

    // 鏡頭狀態（zoom/x/y 為持續狀態；預覽重建 runtime 時清掉上一輪的 transform）
    // layer：鏡頭作用範圍。"all"＝背景＋立繪一起（真正的鏡頭）；
    // "bg"＝只推背景，立繪維持原本大小與位置（想單獨強調景色時用）
    this.camera = { zoom: 1, x: 0, y: 0, layer: "all" };
    for (const el of [dom.backgroundLayer, dom.characterLayer]) {
      if (el) { el.style.transform = ""; el.style.transition = ""; }
    }

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
  serialize() {
    // 引擎進度 + 視覺快照：讀檔時重建染色/帷幕/鏡頭/粒子/立繪定位等持續狀態
    return { ...this.engine.serialize(), visual: this.getVisualSnapshot() };
  }

  async loadState(data) {
    // 快照先套、引擎後跑：engine.loadState 的 step() 會停在文字行等玩家點擊，
    // 若等它 resolve 再套快照，畫面要到第一次點擊後才會還原。
    // 快照存在時抑制 onSceneChange 的場景預設 bg/bgm（快照才是存檔當下的實況）。
    if (data.visual) {
      this._skipNextSceneMeta = true;
      await this.applyVisualSnapshot(data.visual);
    }
    return this.engine.loadState(data);
  }

  /** 蒐集目前所有「持續性」的演出狀態（存檔用） */
  getVisualSnapshot() {
    const chars = [];
    for (const [slot, cur] of Object.entries(this.characterLayer.current || {})) {
      if (cur) chars.push({ slot, charName: cur.charName, emotion: cur.emotion, opts: cur.opts || {} });
    }
    return {
      bg: this.backgroundLayer.current || null,
      bgm: this.audio.currentBgmFile || null,
      chars,
      tint: this.effects?.tintState || null,
      curtain: this.effects?.curtainState || null,
      vignette: this.effects?.vignetteOpacity || 0,
      camera: { ...this.camera },
      particles: this.particles?.type
        ? { type: this.particles.type, density: this.particles.density ?? undefined }
        : null,
      uiHidden: this.uiHidden,
      textcfg: {
        speed: this.textBox.typingSpeed,
        fade: this.textBox.fadeMs,
        indicator: this.textBox.showIndicator,
      },
      video: (this._videoEl && this._videoOpts?.loop && this._videoFile)
        ? { file: this._videoFile, volume: this._videoOpts.volume ?? undefined }
        : null,
    };
  }

  /** 讀檔後套用視覺快照（一律瞬間完成）。舊存檔沒有快照就跳過。 */
  async applyVisualSnapshot(v) {
    if (!v) return;
    if (v.textcfg) this.textBox.configure(v.textcfg);
    if (v.bg && this.backgroundLayer.current !== v.bg) {
      await this.backgroundLayer.change(v.bg, 0);
    }
    // 立繪整批重建（含定位覆寫）
    await this.characterLayer.hideAll(0);
    for (const c of v.chars || []) {
      await this.characterLayer.show(c.charName, c.slot, c.emotion, c.opts || {});
    }
    if (this.effects) {
      if (v.tint) this.effects.tint({ ...v.tint, duration: 0 });
      else this.effects.clearTint({ duration: 0 });
      if (v.curtain) this.effects.curtain({ mode: "close", color: v.curtain.color, full: v.curtain.full, duration: 0 });
      else this.effects.curtain({ mode: "open", duration: 0 });
      this.effects.vignette({ opacity: v.vignette || 0, duration: 0 });
    }
    this.#applyCamera(v.camera || { zoom: 1, x: 0, y: 0 }, 0);
    if (v.particles) this.particles?.start(v.particles.type, { density: v.particles.density });
    else this.particles?.stop();
    this.#setUiHidden(!!v.uiHidden);
    if (v.bgm && this.audio.currentBgmFile !== v.bgm) {
      await this.audio.playBgm(v.bgm, { fadeIn: 300 });
    }
    if (v.video) await this.#startVideo(v.video.file, { loop: true, volume: v.video.volume });
    else this.#removeVideo();
  }
  getPreviewText() { return this.textBox.getPreview(); }

  /**
   * 點擊或按鍵時前進：先讓打字機完成或推進到下一句。
   * @returns {boolean} 是否有處理（供宿主判斷是否要 preventDefault）
   */
  handleAdvanceInput() {
    if (this.autoPlay) this.setAuto(false);   // 玩家介入 → 退出自動播放
    if (this.uiHidden) {
      // 界面隱藏時，任何前進輸入先把界面叫回來（不推進劇情）
      this.#setUiHidden(false);
      return true;
    }
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

  /**
   * @auto on|off：自動播放。打字完成後等 autoDelay 毫秒自動前進；
   * 玩家手動點擊會退出自動播放（一般 VN 慣例）。選項與 @wait 照常等待。
   */
  setAuto(on, delay) {
    this.autoPlay = !!on;
    if (delay != null && !Number.isNaN(Number(delay))) this.autoDelay = Math.max(200, Number(delay));
    clearTimeout(this._autoTimer);
    this._autoTimer = null;
    if (this.autoPlay) this.#autoTick();
  }

  #autoTick() {
    if (!this.autoPlay) return;
    this._autoTimer = setTimeout(() => {
      if (!this.autoPlay) return;
      // 文字打完且在等點擊時才前進（直接走 textBox，不經 handleAdvanceInput
      // —— 那是「玩家輸入」的入口，會取消自動播放）
      if (!this.uiHidden && this.textBox.handleClick()) {
        setTimeout(() => this.engine.advance(), 0);
      }
      this.#autoTick();
    }, this.autoDelay);
  }

  /** @video 的資源網址：預覽走 resolveAsset(blob)，正式遊玩走 storyPath */
  async #videoUrl(fileName) {
    if (this.resolveAsset) {
      const u = await this.resolveAsset("video", fileName);
      if (u) return u;
    }
    return `${this.storyPath}/video/${fileName}`;
  }

  #removeVideo() {
    if (!this._videoEl) return;
    this._videoEl.pause();
    this._videoEl.src = "";
    this._videoEl.remove();
    this._videoEl = null;
    this._videoFile = null;
    this._videoOpts = null;
  }

  /** 建立並播放視頻層；播放失敗回傳 null（不卡劇情） */
  async #startVideo(file, { loop = false, volume = null } = {}) {
    this.#removeVideo();
    const v = document.createElement("video");
    v.className = "fx-video";
    v.src = await this.#videoUrl(file);
    v.loop = loop;
    v.muted = this.audio.muted;
    if (volume != null) v.volume = Math.max(0, Math.min(1, Number(volume)));
    v.playsInline = true;
    this.dom.screen.appendChild(v);
    this._videoEl = v;
    this._videoFile = file;
    this._videoOpts = { loop, volume };
    try {
      await v.play();
    } catch {
      // autoplay 被擋或載入失敗：不能卡死劇情
      this.#removeVideo();
      return null;
    }
    return v;
  }

  /** @ui hide/show：切換文字框與選項的可見性（持續狀態） */
  #setUiHidden(hide) {
    this.uiHidden = !!hide;
    this.dom.screen?.classList.toggle("ui-hidden", this.uiHidden);
  }

  /**
   * @camera：把 zoom/x/y 合併進鏡頭狀態，同一個 transform 套到背景與立繪層。
   * x,y 為畫面百分比：x=10 代表鏡頭右移（內容向左移 10%）。
   * 沒有額外包一層 stage 容器 —— 避免動到 index/preview 的既有 DOM 結構。
   */
  #applyCamera(partial, duration) {
    Object.assign(this.camera, partial);
    const { zoom, x, y, layer } = this.camera;
    const idle = zoom === 1 && x === 0 && y === 0;
    const t = idle ? "" : `scale(${zoom}) translate(${-x}%, ${-y}%)`;
    const setT = (el, transform) => {
      if (!el) return;
      el.style.transformOrigin = "center center";
      el.style.transition = duration > 0 ? `transform ${duration}ms ease` : "none";
      void el.offsetWidth;   // 讓 transition 生效（背景分頁 rAF 不可靠）
      el.style.transform = transform;
    };
    setT(this.dom.backgroundLayer, t);
    // layer="bg" 時立繪不跟著縮放；切換回來時這裡也會把殘留的 transform 清掉
    setT(this.dom.characterLayer, layer === "bg" ? "" : t);
  }

  /** 靜態求值到第 pc 條指令（畫面停在該點，不播放） */
  evaluateTo(sceneId, pc) { return this.engine.evaluateTo(sceneId, pc); }

  /** 停止環境效果（離開遊戲畫面時呼叫） */
  stopAmbient() {
    this.setAuto(false);
    this._lineVoice = false;
    this.#removeVideo();
    this.particles?.stop();
    this.audio.stopBgm(500);
    this.audio.stopVoice();
    this.audio.stopSe();
    this.characterLayer.hideAll(300);
  }

  // ---------- 引擎回呼 ----------
  async #handleText(speaker, text, _state, emotion = null, voice = null) {
    // 當句表情：只對已在場上的角色生效（靜態求值也套用，作者才看得到）
    if (speaker && emotion) await this.characterLayer.setEmotion(speaker, emotion);
    if (speaker) this.characterLayer.setSpeaking(speaker);
    else this.characterLayer.clearSpeaking();

    // 行內語音屬於「這一行」：下一行沒有語音就收掉，聲音不會蓋到下一句。
    // 獨立的 @voice 指令（跨行旁白 VO）不受此規則影響 —— 用 _lineVoice 區分來源。
    if (!this.instant) {
      if (voice) {
        this.audio.playVoice(voice);
        this._lineVoice = true;
      } else if (this._lineVoice) {
        this.audio.stopVoice();
        this._lineVoice = false;
      }
    }

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
        // 獨立語音（跨行 VO）：自由播放，不隨換行收掉。
        // 綁定單句請用行內屬性 `角色 voice=檔名: 台詞`。
        if (this.instant) break;                       // 靜態求值不出聲
        this.audio.playVoice(args.positional[0]);
        this._lineVoice = false;
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
      case "textcfg": {
        // 文本參數（持續狀態）：只改有給的欄位；靜態求值也要套用
        const cfg = {};
        if (args.speed != null) cfg.speed = Number(args.speed);
        if (args.fade != null) cfg.fade = Number(args.fade);
        if (args.indicator != null) cfg.indicator = args.indicator !== "off" && args.indicator !== false;
        this.textBox.configure(cfg);
        break;
      }
      case "curtain": {
        // 帷幕（持續狀態）：close 合上 / open 打開；full 連文字框一起蓋
        if (this.effects) {
          this.effects.curtain({
            mode: args.positional[0] || "close",
            color: args.color || "#000000",
            duration: this.#d(args.duration ?? args.fade ?? 600),
            full: args.full === true || args.full === "true",
          });
        }
        break;
      }
      case "ui": {
        // 顯示/隱藏界面（持續狀態）：hide 後點擊會先恢復界面
        this.#setUiHidden((args.positional[0] || "hide") === "hide");
        break;
      }
      case "camera": {
        // 鏡頭（持續狀態）：只合併有給的欄位；vignette 為暗角透明度 0~1
        const p = {};
        if (args.zoom != null) p.zoom = Number(args.zoom);
        if (args.x != null) p.x = Number(args.x);
        if (args.y != null) p.y = Number(args.y);
        if (args.layer != null) p.layer = String(args.layer) === "bg" ? "bg" : "all";
        const dur = this.#d(args.duration ?? 800);
        if (Object.keys(p).length) this.#applyCamera(p, dur);
        if (args.vignette != null && this.effects) {
          this.effects.vignette({ opacity: Number(args.vignette), duration: dur });
        }
        break;
      }
      case "camera-reset": {
        const dur = this.#d(args.duration ?? 800);
        this.#applyCamera({ zoom: 1, x: 0, y: 0, layer: "all" }, dur);
        this.effects?.vignette({ opacity: 0, duration: dur });
        break;
      }
      case "chapter": {
        // 章節標題卡：淡入→停留→淡出，播放時停住此節奏（靜態求值略過）
        if (this.instant) break;
        const title = args.title || args.positional[0] || "";
        const subtitle = args.subtitle || "";
        if (!title || !this.dom.screen) break;
        const el = document.createElement("div");
        el.className = "chapter-card";
        const inner = document.createElement("div");
        inner.className = "chapter-card-inner";
        const t = document.createElement("div");
        t.className = "chapter-card-title";
        t.textContent = title;
        inner.appendChild(t);
        if (subtitle) {
          const s = document.createElement("div");
          s.className = "chapter-card-sub";
          s.textContent = subtitle;
          inner.appendChild(s);
        }
        el.appendChild(inner);
        this.dom.screen.appendChild(el);
        // 標題卡期間收起文字框與選項，否則（尤其帷幕已拉上時）會從半透明的
        // 卡片後面透出對話框。用獨立 class，不干擾 @ui hide 的既有狀態。
        this.dom.screen.classList.add("chapter-showing");
        const hold = args.duration ?? 2500;
        await new Promise((res) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            el.remove();
            this.dom.screen.classList.remove("chapter-showing");
            res();
          };
          try {
            const anim = el.animate(
              [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }],
              { duration: hold, easing: "ease" });
            anim.finished.catch(() => {}).finally(finish);
          } catch { /* 動畫不支援 */ }
          setTimeout(finish, hold + 200);   // 背景分頁後備
        });
        break;
      }
      case "video": {
        // 視頻層：loop=true 循環（背景影片，用 @video-stop 收掉）；
        // 無 loop 播一次、等結束才繼續。靜態求值跳過（動態內容無法凍結呈現）。
        if (this.instant) break;
        const file = args.positional[0];
        if (!file || !this.dom.screen) break;
        const v = await this.#startVideo(file, {
          loop: args.loop === true || args.loop === "true",
          volume: args.volume,
        });
        if (!v) break;
        if (!v.loop) {
          await new Promise((res) => {
            v.addEventListener("ended", res, { once: true });
            v.addEventListener("error", res, { once: true });
          });
          this.#removeVideo();
        }
        break;
      }
      case "video-stop":
      case "stopvideo": {
        this.#removeVideo();
        break;
      }
      case "particles": {
        // 粒子（持續狀態）：雪/雨/花瓣。scrub 也套用 —— 作者要看得到氛圍
        const type = args.positional[0] || "snow";
        this.particles?.start(type, {
          density: args.density != null ? Number(args.density) : undefined,
        });
        break;
      }
      case "particles-stop":
      case "stopparticles": {
        this.particles?.stop();
        break;
      }
      case "sprite": {
        // 精靈動畫（瞬時）：@sprite 角色 jump|shake|move …
        // 動畫作用在 slot 內的 img（slot 本身可能帶定位 transform，不能覆蓋）
        if (this.instant) break;
        const [charName, effect = "jump"] = args.positional;
        const slotEl = this.characterLayer.getSlotElement?.(charName);
        if (!slotEl) break;
        const target = slotEl.querySelector("img, svg") || slotEl;
        const duration = args.duration ?? 500;
        const frames = [];
        if (effect === "jump") {
          const h = Number(args.height) || 20;
          const times = Math.max(1, parseInt(args.times, 10) || 1);
          for (let i = 0; i < times; i++) {
            frames.push({ transform: "translateY(0)" },
                        { transform: `translateY(-${h}px)` },
                        { transform: "translateY(0)" });
          }
        } else if (effect === "shake") {
          const it = Number(args.intensity) || 8;
          const steps = Math.max(6, Math.round(duration / 40));
          for (let i = 0; i <= steps; i++) {
            const d = (1 - i / steps) * it;
            frames.push({ transform: `translateX(${(i % 2 ? d : -d).toFixed(1)}px)` });
          }
          frames.push({ transform: "translateX(0)" });
        } else if (effect === "move") {
          const dx = Number(args.x) || 0, dy = Number(args.y) || 0;
          frames.push({ transform: "translate(0, 0)" },
                      { transform: `translate(${dx}%, ${dy}%)` },
                      { transform: "translate(0, 0)" });
        }
        if (frames.length) {
          try {
            const anim = target.animate(frames, { duration, easing: "ease-in-out" });
            await Promise.race([anim.finished, wait(duration + 100)]);
          } catch { /* 動畫被中斷 */ }
        }
        break;
      }
      case "se-stop":
      case "stopse": {
        this.audio.stopSe();
        break;
      }
      case "clear": {
        // 銷毀場景（影響持續狀態，靜態求值也要套用）：
        // 清立繪/背景/特效(染色/帷幕/暗角)/鏡頭。音訊用 @bgm-stop / @se-stop 另外控制。
        const d = this.#d(args.fade ?? 400);
        await this.characterLayer.hideAll(d);
        if (args.bg !== false) await this.backgroundLayer.clear(d);
        this.effects?.reset();
        this.#applyCamera({ zoom: 1, x: 0, y: 0, layer: "all" }, 0);
        break;
      }
      case "auto": {
        if (this.instant) break;   // 靜態求值沒有「推進」可言
        const on = (args.positional[0] || "on") !== "off";
        this.setAuto(on, args.delay);
        break;
      }
      case "float": {
        // 浮動文字（瞬時、不阻擋推進）：往上飄並淡出後自刪
        if (this.instant) break;
        const text = args.positional.join(" ") || String(args.text ?? "");
        if (!text || !this.dom.screen) break;
        const el = document.createElement("div");
        el.className = "float-text";
        el.textContent = text;
        el.style.left = `${args.x ?? 50}%`;
        el.style.top = `${args.y ?? 40}%`;
        if (args.color) el.style.color = String(args.color);
        if (args.size) el.style.fontSize = `${Number(args.size)}px`;
        this.dom.screen.appendChild(el);
        const duration = args.duration ?? 1500;
        const rise = Number(args.rise) || 48;
        try {
          const anim = el.animate(
            [{ transform: "translate(-50%, 0)", opacity: 0 },
             { transform: `translate(-50%, -${Math.round(rise * 0.25)}px)`, opacity: 1, offset: 0.2 },
             { transform: `translate(-50%, -${rise}px)`, opacity: 0 }],
            { duration, easing: "ease-out" });
          anim.finished.catch(() => {}).finally(() => el.remove());
          setTimeout(() => el.remove(), duration + 200);   // 背景分頁後備
        } catch { el.remove(); }
        break;
      }
      default:
        console.warn("未知指令:", name, args);
    }
  }

  async #handleSceneChange(sceneMeta) {
    // 讀檔還原時跳過一次：視覺快照已重建實際畫面，場景 meta 的預設值不可蓋掉
    if (this._skipNextSceneMeta) { this._skipNextSceneMeta = false; return; }
    if (sceneMeta.background) await this.backgroundLayer.change(sceneMeta.background, this.#d(600));
    if (sceneMeta.bgm && !this.instant) await this.audio.playBgm(sceneMeta.bgm, { fadeIn: 800 });
  }

  /**
   * 結局的標題／描述以 story.json 的 endings 註冊表為準（唯一真相），
   * 指令自帶的 title/desc 僅作為未登記結局的後備，避免兩處內容不一致。
   */
  #endingInfo(ins) {
    const reg = (this.storyMeta?.endings || []).find((e) => e.id === ins.id);
    return {
      title: reg?.title || ins.title || ins.id || "結局",
      desc: reg?.description || ins.desc || "你的故事走到了這裡。",
    };
  }

  async #handleEnding(endingIns) {
    const { title, desc } = this.#endingInfo(endingIns);
    if (this.instant) {
      this.textBox.showInstant("", `—— 結局：${title} ——`);
      return;
    }
    await wait(500);
    await this.textBox.showText("", `—— 結局：${title} ——`);
    await wait(1500);
    await this.textBox.showText("", desc);
    await wait(2000);
    if (this.onEndingCb) this.onEndingCb(endingIns);
  }
}
