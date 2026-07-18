// ============================================
// CharacterManager.js
// 角色定義管理（常駐於「資產」頁的「角色」分類）。
// 原為資料庫 Hub 的「角色」分頁；拆分後成為獨立視圖。
//
// 常駐視圖與 dialog 的差異：必須訂閱專案事件自動重繪。
// 自己寫入時以 _writing 守衛跳過重繪，避免輸入框在 blur 的
// change 事件中被整面重建（游標與焦點會憑空消失）。
// ============================================

import { subLabel, datalistInput, escapeHtml } from "../widgets/formFields.js";
import { promptDialog, openModal, confirmDialog } from "../widgets/dialog.js";

// 只關心會改變本面板內容的事件（縮圖要重新讀 blob，重繪不便宜）
const EVENTS = new Set(["loaded", "characters-updated", "resources-updated", "undo", "redo"]);

export class CharacterManager {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this._thumbUrls = [];   // 縮圖 objectURL，重繪／卸載時撤銷
    this._writing = false;
    this._selected = null;         // 目前選中的角色名
    this._selectedEmotion = "__default__";  // 目前選中的表情（或預設立繪）
    this._unsub = project.subscribe((t) => {
      if (this._writing) return;
      if (EVENTS.has(t)) this.render();
    });
    this.render();
  }

  destroy() {
    this._unsub?.();
    this.#revokeThumbs();
    this.containerEl.innerHTML = "";
  }

  /** 自己發起的寫入不觸發自我重繪 */
  #write(fn) { this._writing = true; try { fn(); } finally { this._writing = false; } }

  #revokeThumbs() {
    for (const u of this._thumbUrls) URL.revokeObjectURL(u);
    this._thumbUrls = [];
    this._cropRO?.disconnect();   // 舊裁切框的觀察器隨 DOM 一起收掉
    this._cropRO = null;
  }

  // 非同步把某個立繪縮圖填進 img（找不到就顯示 placeholder 樣式）
  #fillThumb(img, file) {
    img.classList.add("char-thumb");
    if (!file) { img.classList.add("empty"); return; }
    this.project.fs?.readResource?.("characters", file).then((blob) => {
      if (!blob) { img.classList.add("empty"); return; }
      const url = URL.createObjectURL(blob);
      this._thumbUrls.push(url);
      img.src = url;
      img.classList.remove("empty");
    }).catch(() => img.classList.add("empty"));
  }

  // 載入完整立繪到 <img>（不套縮圖尺寸 class，供右欄大圖用）
  #fillImage(img, file) {
    if (!file) { img.classList.add("empty"); return; }
    this.project.fs?.readResource?.("characters", file).then((blob) => {
      if (!blob) { img.classList.add("empty"); return; }
      const url = URL.createObjectURL(blob);
      this._thumbUrls.push(url);
      img.src = url;
      img.classList.remove("empty");
    }).catch(() => img.classList.add("empty"));
  }

  // 背景式裁切縮圖：套用 spriteCrops[檔名] 的正規化裁切範圍（無裁切則 contain）
  #fillCropThumb(el, file) {
    el.classList.add("crop-thumb");
    if (!file) { el.classList.add("empty"); return; }
    this.project.fs?.readResource?.("characters", file).then((blob) => {
      if (!blob) { el.classList.add("empty"); return; }
      const url = URL.createObjectURL(blob);
      this._thumbUrls.push(url);
      el.classList.remove("empty");
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundRepeat = "no-repeat";
      const c = this.project.getSpriteCrop(file);
      if (c && c.w > 0 && c.h > 0) {
        el.style.backgroundSize = `${100 / c.w}% ${100 / c.h}%`;
        el.style.backgroundPosition =
          `${c.w < 1 ? (c.x / (1 - c.w)) * 100 : 50}% ${c.h < 1 ? (c.y / (1 - c.h)) * 100 : 50}%`;
      } else {
        el.style.backgroundSize = "contain";
        el.style.backgroundPosition = "center";
      }
    }).catch(() => el.classList.add("empty"));
  }

  render() {
    this.#revokeThumbs();
    this.containerEl.innerHTML = "";

    if (!this.project.storyMeta) {
      this.containerEl.innerHTML = `<div class="asset-empty">開啟專案後可在此管理角色</div>`;
      return;
    }

    const chars = this.project.storyMeta.characters || {};
    const names = Object.keys(chars);

    // 解析選取：選中的角色若已不存在，退回第一個
    if (this._selected && !chars[this._selected]) this._selected = null;
    if (!this._selected && names.length) this._selected = names[0];

    const wrap = document.createElement("div");
    wrap.className = "mgr-panel char-mgr";

    const intro = subLabel("定義角色與表情差分後，劇本的 @show 可用「角色名 位置 表情」切換立繪。");
    intro.style.display = "block";
    intro.style.marginBottom = "12px";
    wrap.appendChild(intro);

    // 三欄式：角色 ｜ 表情 ｜ 立繪完整檢視
    const md = document.createElement("div");
    md.className = "char-md char-md-3col";
    md.appendChild(this.#renderMasterList(chars, names));

    if (this._selected) {
      const data = chars[this._selected];
      // 解析選中的表情（預設 / 某表情），失效則退回預設立繪
      const keys = ["__default__", ...Object.keys(data.emotions || {})];
      if (!keys.includes(this._selectedEmotion)) this._selectedEmotion = "__default__";
      md.appendChild(this.#renderEmotionColumn(this._selected, data));
      md.appendChild(this.#renderSpriteView(this._selected, data));
    } else {
      const empty = document.createElement("div");
      empty.className = "char-md-empty";
      empty.textContent = "從左側選擇一個角色，即可編輯其立繪與表情差分。";
      md.appendChild(empty);
    }
    wrap.appendChild(md);

    this.containerEl.appendChild(wrap);
  }

  // ---- 左欄：角色清單（縮圖 + 名字 + 刪除） ----
  #renderMasterList(chars, names) {
    const listCol = document.createElement("div");
    listCol.className = "char-md-list";

    for (const name of names) {
      listCol.appendChild(this.#renderListItem(name, chars[name]));
    }
    if (names.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒定義任何角色";
      listCol.appendChild(empty);
    }

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn char-md-add";
    addBtn.textContent = "+ 新增角色";
    addBtn.addEventListener("click", async () => {
      const name = await promptDialog({
        title: "新增角色",
        label: "新角色的名稱",
        placeholder: "例：愛麗絲",
        validate: (v) => {
          if (!v.trim()) return "請輸入角色名稱";
          if ((this.project.storyMeta.characters || {})[v.trim()]) return "角色已存在";
          return null;
        },
      });
      if (name === null) return;
      const id = name.trim();
      this._selected = id;
      this.#write(() => this.project.upsertCharacter(id, { default: "", emotions: {} }));
      this.render();   // 結構變了，整面重繪
    });
    listCol.appendChild(addBtn);

    return listCol;
  }

  #renderListItem(name, data) {
    const item = document.createElement("div");
    item.className = "char-md-item" + (name === this._selected ? " active" : "");

    const thumb = document.createElement("div");
    thumb.classList.add("char-md-thumb");
    this.#fillCropThumb(thumb, data.default);
    item.appendChild(thumb);

    const label = document.createElement("span");
    label.className = "char-md-item-name";
    label.textContent = name;
    item.appendChild(label);

    const delBtn = document.createElement("button");
    delBtn.className = "char-delete";
    delBtn.title = "刪除角色";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog({
        title: `刪除角色「${name}」？`,
        message: "這不會刪除劇本中對這個角色的引用。",
        confirmText: "刪除角色", danger: true,
      }))) return;
      if (this._selected === name) this._selected = null;
      this.#write(() => this.project.removeCharacter(name));
      this.render();
    });
    item.appendChild(delBtn);

    item.addEventListener("click", () => {
      if (this._selected === name) return;
      this._selected = name;
      this._selectedEmotion = "__default__";   // 換角色 → 回到預設立繪
      this.render();
    });

    return item;
  }

  // ---- 中欄：表情清單（預設立繪 + 各表情，縮圖列） ----
  #renderEmotionColumn(name, data) {
    const col = document.createElement("div");
    col.className = "char-emo-col";

    const head = document.createElement("div");
    head.className = "char-emo-head";
    head.innerHTML = `<strong class="char-name">${escapeHtml(name)}</strong>`;
    col.appendChild(head);

    const list = document.createElement("div");
    list.className = "char-emo-list";

    // 預設立繪（特殊項，永遠在最上）
    list.appendChild(this.#renderEmoItem(name, data, "__default__", data.default, "預設立繪", true));
    // 各表情
    for (const [emoName, emoFile] of Object.entries(data.emotions || {})) {
      list.appendChild(this.#renderEmoItem(name, data, emoName, emoFile, emoName, false));
    }
    col.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "emotion-actions";
    const addEmoBtn = document.createElement("button");
    addEmoBtn.className = "emotion-add";
    addEmoBtn.textContent = "+ 新表情";
    addEmoBtn.addEventListener("click", async () => {
      const emoName = await promptDialog({
        title: "新表情",
        label: `為「${name}」新增一個表情差分`,
        placeholder: "例：happy、sad",
        validate: (v) => {
          if (!v.trim()) return "請輸入表情名稱";
          if ((data.emotions || {})[v.trim()]) return "這個表情已存在";
          return null;
        },
      });
      if (emoName === null) return;
      if (!data.emotions) data.emotions = {};
      data.emotions[emoName.trim()] = "";
      this._selectedEmotion = emoName.trim();
      this.#write(() => this.project.upsertCharacter(name, data));
      this.render();
    });
    actions.appendChild(addEmoBtn);

    const pickBtn = document.createElement("button");
    pickBtn.className = "emotion-add";
    pickBtn.textContent = "＋ 從立繪加入";
    pickBtn.addEventListener("click", () => this.#pickSpriteAsEmotion(name, data));
    actions.appendChild(pickBtn);
    col.appendChild(actions);

    return col;
  }

  #renderEmoItem(charName, data, key, file, label, isDefault) {
    const item = document.createElement("div");
    item.className = "char-emo-item" + (this._selectedEmotion === key ? " active" : "");

    const thumb = document.createElement("div");
    thumb.classList.add("char-emo-thumb");
    this.#fillCropThumb(thumb, file);
    item.appendChild(thumb);

    const lab = document.createElement("span");
    lab.className = "char-emo-name" + (isDefault ? " is-default" : "");
    lab.textContent = label;
    item.appendChild(lab);

    if (!isDefault) {
      const del = document.createElement("button");
      del.className = "char-delete";
      del.title = "刪除表情";
      del.textContent = "×";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        delete data.emotions[key];
        if (this._selectedEmotion === key) this._selectedEmotion = "__default__";
        this.#write(() => this.project.upsertCharacter(charName, data));
        this.render();
      });
      item.appendChild(del);
    }

    item.addEventListener("click", () => {
      if (this._selectedEmotion === key) return;
      this._selectedEmotion = key;
      this.render();
    });
    return item;
  }

  // ---- 右欄：選中立繪的完整檢視 + 檔名設定 ----
  #renderSpriteView(name, data) {
    const view = document.createElement("div");
    view.className = "char-sprite-view";

    const key = this._selectedEmotion;
    const isDefault = key === "__default__";
    const file = isDefault ? data.default : (data.emotions || {})[key];
    const label = isDefault ? "預設立繪" : key;

    const head = document.createElement("div");
    head.className = "char-sprite-head";
    head.innerHTML = `<strong>${escapeHtml(label)}</strong>`;
    view.appendChild(head);

    const stage = document.createElement("div");
    stage.className = "char-sprite-stage";
    const img = document.createElement("img");
    img.className = "char-sprite-big";
    this.#fillImage(img, file);
    stage.appendChild(img);
    // 裁切框（設定縮圖範圍）—— 圖片載入取得原始尺寸後才架設
    if (file) {
      const box = document.createElement("div");
      box.className = "crop-box";
      box.innerHTML = `<span class="crop-handle"></span>`;
      stage.appendChild(box);
      if (img.complete && img.naturalWidth) this.#setupCrop(stage, img, box, file);
      else img.addEventListener("load", () => this.#setupCrop(stage, img, box, file), { once: true });
    }
    view.appendChild(stage);

    const fld = document.createElement("div");
    fld.className = "char-field";
    fld.appendChild(subLabel("立繪檔案"));
    const input = datalistInput({
      value: file || "",
      options: this.project.resources.characters,
      placeholder: "檔名，例 alice_normal.png",
      onChange: (v) => {
        if (isDefault) data.default = v;
        else data.emotions[key] = v;
        this.#write(() => this.project.upsertCharacter(name, data));
        this.#fillImage(img, v);
        // 中欄縮圖也要更新 → 重繪
        this.render();
      }
    });
    fld.appendChild(input);
    view.appendChild(fld);

    if (file) {
      const cropRow = document.createElement("div");
      cropRow.className = "crop-row";
      const hint = document.createElement("small");
      hint.className = "crop-hint";
      hint.textContent = "拖曳方框設定縮圖範圍（角色/表情欄的縮圖會套用）。";
      cropRow.appendChild(hint);
      const clear = document.createElement("button");
      clear.className = "tb-btn";
      clear.textContent = "清除裁切";
      clear.disabled = !this.project.getSpriteCrop(file);
      clear.addEventListener("click", () => {
        this.#write(() => this.project.setSpriteCrop(file, null));
        this.render();
      });
      cropRow.appendChild(clear);
      view.appendChild(cropRow);
    }

    return view;
  }

  // 影像在 object-fit:contain 下的實際內容矩形（相對 viewport）
  #imageContentRect(img) {
    const b = img.getBoundingClientRect();
    const nW = img.naturalWidth, nH = img.naturalHeight;
    if (!nW || !nH) return b;
    const scale = Math.min(b.width / nW, b.height / nH);
    const w = nW * scale, h = nH * scale;
    return { left: b.left + (b.width - w) / 2, top: b.top + (b.height - h) / 2, width: w, height: h };
  }

  // 架設裁切框：定位到既有 crop（或預設上半置中），支援移動 + 右下角縮放。
  // 注意：資產頁在初次 render 時可能還是 display:none（量到 0），所以
  // 尺寸一律「用到才量」，並以 ResizeObserver 在面板現身／改寬時重新定位。
  #setupCrop(stage, img, box, file) {
    const saved = this.project.getSpriteCrop(file);
    let n = saved || { x: 0.25, y: 0.05, w: 0.5, h: 0.4 };   // 預設：上半置中（臉部）

    // 影像內容矩形（相對 stage）
    const metrics = () => {
      const c = this.#imageContentRect(img);
      const s = stage.getBoundingClientRect();
      return { ox: c.left - s.left, oy: c.top - s.top, cw: c.width, ch: c.height };
    };

    const place = () => {
      const { ox, oy, cw, ch } = metrics();
      if (cw <= 0 || ch <= 0) { box.style.visibility = "hidden"; return; }
      box.style.visibility = "";
      box.style.left = `${ox + n.x * cw}px`;
      box.style.top = `${oy + n.y * ch}px`;
      box.style.width = `${n.w * cw}px`;
      box.style.height = `${n.h * ch}px`;
    };
    place();

    // 面板由隱藏轉可見／欄寬改變時重新定位
    this._cropRO?.disconnect();
    this._cropRO = new ResizeObserver(() => place());
    this._cropRO.observe(stage);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const save = () => {
      n = {
        x: +n.x.toFixed(4), y: +n.y.toFixed(4),
        w: +n.w.toFixed(4), h: +n.h.toFixed(4),
      };
      this.#write(() => this.project.setSpriteCrop(file, n));
      this.render();   // 更新縮圖與「清除裁切」可用性
    };

    const onDown = (e, mode) => {
      const { cw, ch } = metrics();          // 拖曳當下才量，確保是可見時的正確尺寸
      if (cw <= 0 || ch <= 0) return;
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY;
      const start = { ...n };
      const move = (ev) => {
        const dx = (ev.clientX - sx) / cw, dy = (ev.clientY - sy) / ch;
        if (mode === "move") {
          n.x = clamp(start.x + dx, 0, 1 - n.w);
          n.y = clamp(start.y + dy, 0, 1 - n.h);
        } else {
          n.w = clamp(start.w + dx, 0.05, 1 - n.x);
          n.h = clamp(start.h + dy, 0.05, 1 - n.y);
        }
        place();
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        save();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    box.addEventListener("mousedown", (e) => onDown(e, "move"));
    box.querySelector(".crop-handle").addEventListener("mousedown", (e) => onDown(e, "resize"));
  }

  // 從立繪檔案直接設為表情：選圖 → 命名（自動猜）→ 建立差分
  async #pickSpriteAsEmotion(name, data) {
    const files = this.project.resources.characters || [];
    // 已被此角色用掉的檔（預設 + 各表情）標記為 used
    const used = new Set([data.default, ...Object.values(data.emotions || {})].filter(Boolean));

    const file = await openModal(`從立繪加入表情 · ${name}`, (close) => {
      const grid = document.createElement("div");
      grid.className = "sprite-pick-grid";
      if (files.length === 0) {
        const empty = document.createElement("div");
        empty.className = "sprite-pick-empty";
        empty.textContent = "尚無立繪檔案（可先到「立繪檔案」區匯入）";
        grid.appendChild(empty);
        return grid;
      }
      for (const f of files) {
        const item = document.createElement("div");
        item.className = "sprite-pick-item" + (used.has(f) ? " used" : "");
        const img = document.createElement("img");
        img.className = "sprite-pick-thumb";
        this.#fillThumb(img, f);
        const cap = document.createElement("div");
        cap.className = "sprite-pick-name";
        cap.textContent = f;
        item.append(img, cap);
        item.title = used.has(f) ? `${f}（已使用）` : f;
        item.addEventListener("click", () => close(f));
        grid.appendChild(item);
      }
      return grid;
    }, { wide: true });

    if (!file) return;

    const emoName = await promptDialog({
      title: "設為表情",
      label: `把「${file}」設為哪個表情？`,
      value: this.#guessEmotionName(file, name, data),
      placeholder: "例：happy、sad",
      validate: (v) => {
        if (!v.trim()) return "請輸入表情名稱";
        if ((data.emotions || {})[v.trim()]) return "這個表情已存在";
        return null;
      },
    });
    if (emoName === null) return;
    if (!data.emotions) data.emotions = {};
    data.emotions[emoName.trim()] = file;
    this.#write(() => this.project.upsertCharacter(name, data));
    this.render();
  }

  // 從檔名猜表情名：去副檔名，取最後一個底線後的片段；避開已存在的名稱
  #guessEmotionName(file, _charName, data) {
    const stem = String(file).replace(/\.[^.]+$/, "");
    const parts = stem.split(/[_\-]/).filter(Boolean);
    let guess = parts.length > 1 ? parts[parts.length - 1] : stem;
    const existing = data.emotions || {};
    if (existing[guess]) guess = "";   // 撞名就留空讓使用者填
    return guess;
  }

}
