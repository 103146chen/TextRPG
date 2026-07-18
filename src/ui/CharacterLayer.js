// ============================================
// CharacterLayer.js
// 立繪管理：顯示/隱藏/移動/表情切換
// ============================================

// 錨點定義與編輯器共用同一份，避免格線示意與實際渲染漂移
import { anchorOf, DEFAULT_ANCHOR, DEFAULT_HEIGHT_PCT } from "./anchors.js";

export class CharacterLayer {
  /**
   * @param {HTMLElement} layerEl
   * @param {string} storyPath
   * @param {object} characterMap - name -> { default, emotions }
   * @param {function} [resolveAsset] - (kind, file) => Promise<url>，供即時預覽用 blob URL
   * @param {object} [positions] - story.json 的具名位置預設：
   *   { center: { x, y, anchor, scale }, ... }。未提供時沿用原本的 CSS 三格版面。
   */
  constructor(layerEl, storyPath, characterMap = {}, resolveAsset = null, positions = null, spriteAdjust = null) {
    this.layerEl = layerEl;
    this.storyPath = storyPath;
    this.resolveAsset = resolveAsset;
    this.characterMap = characterMap;
    this.positions = positions || null;
    // 單張立繪的顯示修正 { 檔名: {crop,dx,dy,scale} }：修正「這張圖本身」的
    // 構圖，與槽位/指令的定位相疊加，不取代它們。
    this.spriteAdjust = spriteAdjust || null;
    // 內建三格沿用 HTML 既有元素；其餘具名位置在需要時動態建立
    this.slots = {
      left: layerEl.querySelector('[data-slot="left"]'),
      center: layerEl.querySelector('[data-slot="center"]'),
      right: layerEl.querySelector('[data-slot="right"]'),
    };
    this.current = { left: null, center: null, right: null };
  }

  /** 依角色名找到目前所在的 slot 容器（精靈動畫用）；不在場上回傳 null */
  getSlotElement(charName) {
    for (const [slot, cur] of Object.entries(this.current)) {
      if (cur?.charName === charName) return this.slots[slot] || null;
    }
    return null;
  }

  /** 取得（必要時建立）指定 slot 的容器。slot 是「身分鍵」：同一 slot 再 show 會取代前一個角色。 */
  #ensureSlot(slot) {
    if (this.slots[slot]) return this.slots[slot];
    const el = document.createElement("div");
    el.className = "char-slot";
    el.dataset.slot = slot;
    this.layerEl.appendChild(el);
    this.slots[slot] = el;
    if (!(slot in this.current)) this.current[slot] = null;
    return el;
  }

  /**
   * 套用定位：opts（指令上的 pos/anchor/scale）優先於 story.json 的具名預設。
   * 兩者都沒有時清掉 inline 樣式，回到原本的 CSS 三格版面（既有劇本走這條，畫面零變化）。
   */
  #applyPlacement(slotEl, slot, opts = {}) {
    const preset = this.positions?.[slot] || null;
    const hasPos = opts.pos != null || (preset && preset.x != null && preset.y != null);
    const anchorName = opts.anchor ?? preset?.anchor ?? DEFAULT_ANCHOR;
    const scale = opts.scale ?? preset?.scale ?? null;

    if (!hasPos && scale == null && opts.anchor == null) {
      slotEl.classList.remove("positioned");
      slotEl.style.left = slotEl.style.top = slotEl.style.right = slotEl.style.bottom = "";
      slotEl.style.width = slotEl.style.height = "";
      slotEl.style.transform = slotEl.style.transformOrigin = "";
      return;
    }

    let x, y;
    if (opts.pos != null) {
      [x, y] = String(opts.pos).split(",").map((v) => parseFloat(v));
    } else if (preset) {
      x = preset.x; y = preset.y;
    }
    const a = anchorOf(anchorName);

    slotEl.classList.add("positioned");
    slotEl.style.right = "auto";
    slotEl.style.bottom = "auto";
    if (Number.isFinite(x)) slotEl.style.left = `${x}%`;
    if (Number.isFinite(y)) slotEl.style.top = `${y}%`;
    slotEl.style.width = "auto";
    slotEl.style.height = `${DEFAULT_HEIGHT_PCT}%`;
    slotEl.style.transformOrigin = a.o;
    slotEl.style.transform = `translate(${a.t})${scale != null ? ` scale(${scale})` : ""}`;
  }

  /**
   * 顯示角色: @show alice center happy
   */
  async show(charName, slot, emotion, opts = {}) {
    const slotEl = this.#ensureSlot(slot);
    if (!slotEl) return;
    this.#applyPlacement(slotEl, slot, opts);
    const charData = this.characterMap[charName];
    if (!charData) {
      console.warn(`未定義角色: ${charName}`);
      return;
    }

    const fileName = emotion && charData.emotions?.[emotion]
      ? charData.emotions[emotion]
      : charData.default;

    // 若已在這個位置且檔案相同，只切表情（淡出再淡入）
    const existing = this.current[slot];
    if (existing && existing.charName === charName) {
      const img = slotEl.querySelector("img, svg");
      if (img) {
        img.classList.remove("show");
        await this.#wait(200);
      }
    }

    slotEl.innerHTML = "";
    const url = await this.#assetUrl("characters", fileName);
    // 有單張修正才包 wrapper；沒有的話維持原本的純 <img>（零行為變動）
    const adj = this.spriteAdjust?.[fileName] || null;
    const node = adj ? this.#createAdjustedImg(url, charName, adj) : this.#createImg(url, charName);
    slotEl.appendChild(node);
    const img = node.tagName === "IMG" ? node : node.querySelector("img");
    // 強制重繪
    await this.#wait(20);
    img?.classList.add("show");

    this.current[slot] = { charName, emotion, fileName, opts: { ...opts } };   // opts 供存檔快照還原定位
  }

  /**
   * 只切換「已在場上」角色的表情，位置與縮放沿用原本的設定。
   * 角色不在場上時什麼都不做——對話行的表情只是修飾，不該無中生有把人叫出來。
   * @returns {boolean} 是否真的切了
   */
  async setEmotion(charName, emotion) {
    for (const [slot, cur] of Object.entries(this.current)) {
      if (cur?.charName === charName) {
        if (cur.emotion === emotion) return true;      // 已經是這個表情
        await this.show(charName, slot, emotion, cur.opts || {});
        return true;
      }
    }
    return false;
  }

  async hide(charName, fadeMs = 400) {
    for (const slot of Object.keys(this.slots)) {
      if (this.current[slot]?.charName === charName) {
        const slotEl = this.slots[slot];
        const img = slotEl.querySelector("img, svg");
        if (img) {
          img.classList.remove("show");
          await this.#wait(fadeMs);
          slotEl.innerHTML = "";
        }
        this.current[slot] = null;
      }
    }
  }

  async hideAll(fadeMs = 400) {
    for (const slot of Object.keys(this.slots)) {
      const slotEl = this.slots[slot];
      const img = slotEl.querySelector("img, svg");
      if (img) {
        img.classList.remove("show");
      }
    }
    await this.#wait(fadeMs);
    for (const slot of Object.keys(this.slots)) {
      this.slots[slot].innerHTML = "";
      this.current[slot] = null;
    }
  }

  /**
   * 標記某個角色正在說話（亮度加強，其他變暗）
   */
  setSpeaking(charName) {
    for (const slot of Object.keys(this.slots)) {
      const slotEl = this.slots[slot];
      const cur = this.current[slot];
      if (cur && cur.charName === charName) {
        slotEl.classList.add("speaking");
      } else {
        slotEl.classList.remove("speaking");
      }
    }
  }

  clearSpeaking() {
    for (const slot of Object.keys(this.slots)) {
      this.slots[slot].classList.remove("speaking");
    }
  }

  // 解析資產 URL：有 resolveAsset 就用它（blob URL），否則退回路徑
  async #assetUrl(kind, fileName) {
    if (this.resolveAsset) {
      const u = await this.resolveAsset(kind, fileName);
      if (u) return u;
    }
    return `${this.storyPath}/${kind}/${fileName}`;
  }

  #createImg(url, charName) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = charName;
    img.onerror = () => {
      // fallback: 以 SVG placeholder 代替
      const svg = this.#createPlaceholder(charName);
      img.replaceWith(svg);
      // 強制下一幀加上 show 類別
      requestAnimationFrame(() => svg.classList.add("show"));
    };
    return img;
  }

  /**
   * 帶「單張修正」的立繪節點：外層 wrapper 吃位移/縮放與裁切，內層 img 保留
   * 原本的淡入動畫（.show）。沒有修正的圖不會走這裡——維持原本的純 <img>，
   * 確保既有劇本的渲染完全不變。
   *
   * 裁切用「外層 overflow:hidden ＋ 內層等比放大位移」：
   *   wrapper 長寬比 = 裁切區的實際長寬比 → 內層百分比放大不會變形。
   */
  #createAdjustedImg(url, charName, adj) {
    const wrap = document.createElement("div");
    wrap.className = "char-sprite-adj";

    const img = this.#createImg(url, charName);
    const c = adj.crop;

    if (c && c.w > 0 && c.h > 0) {
      wrap.classList.add("cropped");
      img.style.width = `${100 / c.w}%`;
      img.style.height = `${100 / c.h}%`;
      img.style.left = `${-(c.x / c.w) * 100}%`;
      img.style.top = `${-(c.y / c.h) * 100}%`;
      // 長寬比要等圖片載入拿到原始尺寸才算得出來
      const setRatio = () => {
        const nW = img.naturalWidth, nH = img.naturalHeight;
        if (nW && nH) wrap.style.aspectRatio = `${c.w * nW} / ${c.h * nH}`;
      };
      if (img.complete && img.naturalWidth) setRatio();
      else img.addEventListener("load", setRatio, { once: true });
    }

    const dx = Number(adj.dx) || 0, dy = Number(adj.dy) || 0;
    const s = Number.isFinite(adj.scale) ? adj.scale : 1;
    if (dx || dy || s !== 1) {
      wrap.style.transform = `translate(${dx}%, ${dy}%)${s !== 1 ? ` scale(${s})` : ""}`;
    }

    wrap.appendChild(img);
    return wrap;
  }

  #createPlaceholder(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 200 500");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.innerHTML = `
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d4869c" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#7a2e44" stop-opacity="0.5"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="120" rx="50" ry="60" fill="url(#g1)" stroke="#c9a45e" stroke-width="1"/>
      <path d="M 50 200 Q 100 180 150 200 L 165 480 L 35 480 Z" fill="url(#g1)" stroke="#c9a45e" stroke-width="1"/>
      <text x="100" y="130" text-anchor="middle" fill="#f5efe3" font-size="20" font-family="serif">${this.#escape(name)}</text>
    `;
    return svg;
  }

  #escape(s) {
    return String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  #wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// ============================================
// BackgroundLayer.js (同檔案匯出，省檔案數量)
// ============================================

export class BackgroundLayer {
  constructor(layerEl, storyPath, resolveAsset = null) {
    this.layerEl = layerEl;
    this.storyPath = storyPath;
    this.resolveAsset = resolveAsset;
    this.current = null;
  }

  async #assetUrl(kind, fileName) {
    if (this.resolveAsset) {
      const u = await this.resolveAsset(kind, fileName);
      if (u) return u;
    }
    return `${this.storyPath}/${kind}/${fileName}`;
  }

  /** 清除背景（@clear 銷毀場景用） */
  async clear(fadeMs = 400) {
    if (this.current === null && !this.layerEl.style.backgroundImage) return;
    this.current = null;
    this.layerEl.classList.add("fading");
    await this.#wait(fadeMs / 2);
    this.layerEl.style.backgroundImage = "";
    this.layerEl.classList.remove("fading");
  }

  async change(fileName, fadeMs = 800) {
    if (this.current === fileName) return;
    this.current = fileName;

    // 淡出
    this.layerEl.classList.add("fading");
    await this.#wait(fadeMs / 2);

    const url = await this.#assetUrl("backgrounds", fileName);
    const img = new Image();
    const loaded = await new Promise(resolve => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      // 2 秒 timeout 防呆
      setTimeout(() => resolve(img.complete), 2000);
    });

    if (loaded && (img.naturalWidth > 0 || fileName.endsWith(".svg"))) {
      this.layerEl.style.backgroundImage = `url("${url}")`;
    } else {
      this.#applyPlaceholder(fileName);
    }
    this.layerEl.classList.remove("fading");
  }

  #applyPlaceholder(fileName) {
    // 從檔名猜顏色（室內/室外/夜/日）
    const n = fileName.toLowerCase();
    let grad;
    if (n.includes("night") || n.includes("evening")) {
      grad = "linear-gradient(180deg, #1a1f3a 0%, #2d1b3d 60%, #4a2844 100%)";
    } else if (n.includes("cafe") || n.includes("room") || n.includes("indoor")) {
      grad = "linear-gradient(180deg, #8b6f4e 0%, #5a4330 50%, #2e1f14 100%)";
    } else if (n.includes("school") || n.includes("classroom")) {
      grad = "linear-gradient(180deg, #c9a45e 0%, #8b7541 50%, #3d362e 100%)";
    } else if (n.includes("park") || n.includes("garden") || n.includes("outdoor")) {
      grad = "linear-gradient(180deg, #a8c5a0 0%, #6b8e7b 50%, #3d5148 100%)";
    } else if (n.includes("beach") || n.includes("sea")) {
      grad = "linear-gradient(180deg, #b8d4e3 0%, #6b9dc0 50%, #2d5470 100%)";
    } else {
      grad = "linear-gradient(180deg, #2a2621 0%, #1a1814 100%)";
    }
    this.layerEl.style.backgroundImage = grad;
  }

  #wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}
