// ============================================
// CharacterLayer.js
// 立繪管理：顯示/隱藏/移動/表情切換
// ============================================

export class CharacterLayer {
  constructor(layerEl, storyPath, characterMap = {}) {
    this.layerEl = layerEl;
    this.storyPath = storyPath;
    this.characterMap = characterMap; // name -> {defaultFile, emotions: {happy: "alice_happy.png"}}
    this.slots = {
      left: layerEl.querySelector('[data-slot="left"]'),
      center: layerEl.querySelector('[data-slot="center"]'),
      right: layerEl.querySelector('[data-slot="right"]'),
    };
    this.current = { left: null, center: null, right: null };
  }

  /**
   * 顯示角色: @show alice center happy
   */
  async show(charName, slot, emotion) {
    const slotEl = this.slots[slot];
    if (!slotEl) return;
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
    const img = this.#createImg(fileName, charName);
    slotEl.appendChild(img);
    // 強制重繪
    await this.#wait(20);
    img.classList.add("show");

    this.current[slot] = { charName, emotion, fileName };
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

  #createImg(fileName, charName) {
    // 若檔名以 .svg 結尾且是 inline 資源，使用 img 標籤即可
    const img = document.createElement("img");
    img.src = `${this.storyPath}/characters/${fileName}`;
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
  constructor(layerEl, storyPath) {
    this.layerEl = layerEl;
    this.storyPath = storyPath;
    this.current = null;
  }

  async change(fileName, fadeMs = 800) {
    if (this.current === fileName) return;
    this.current = fileName;

    // 淡出
    this.layerEl.classList.add("fading");
    await this.#wait(fadeMs / 2);

    const url = `${this.storyPath}/backgrounds/${fileName}`;
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
