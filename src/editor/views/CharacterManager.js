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
import { promptDialog } from "../widgets/dialog.js";

// 只關心會改變本面板內容的事件（縮圖要重新讀 blob，重繪不便宜）
const EVENTS = new Set(["loaded", "characters-updated", "resources-updated", "undo", "redo"]);

export class CharacterManager {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this._thumbUrls = [];   // 縮圖 objectURL，重繪／卸載時撤銷
    this._writing = false;
    this._selected = null;  // 主從式：目前選中的角色名
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

    // 主從式：左側角色清單 ｜ 右側選中角色的表情差分
    const md = document.createElement("div");
    md.className = "char-md";
    md.appendChild(this.#renderMasterList(chars, names));
    md.appendChild(this.#renderDetail(this._selected, this._selected ? chars[this._selected] : null));
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

    const thumb = document.createElement("img");
    thumb.classList.add("char-md-thumb");
    this.#fillThumb(thumb, data.default);
    item.appendChild(thumb);

    const label = document.createElement("span");
    label.className = "char-md-item-name";
    label.textContent = name;
    item.appendChild(label);

    const delBtn = document.createElement("button");
    delBtn.className = "char-delete";
    delBtn.title = "刪除角色";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`刪除角色「${name}」？\n這不會刪除劇本中對這個角色的引用。`)) return;
      if (this._selected === name) this._selected = null;
      this.#write(() => this.project.removeCharacter(name));
      this.render();
    });
    item.appendChild(delBtn);

    item.addEventListener("click", () => {
      if (this._selected === name) return;
      this._selected = name;
      this.render();
    });

    return item;
  }

  // ---- 右欄：選中角色的預設立繪 + 表情差分牆 ----
  #renderDetail(name, data) {
    const detail = document.createElement("div");
    detail.className = "char-md-detail";

    if (!name || !data) {
      detail.innerHTML = `<div class="char-md-empty">從左側選擇一個角色，即可編輯其立繪與表情差分。</div>`;
      return detail;
    }

    const charResources = this.project.resources.characters;

    const header = document.createElement("div");
    header.className = "char-md-detail-head";
    header.innerHTML = `<strong class="char-name">${escapeHtml(name)}</strong>`;
    detail.appendChild(header);

    // 預設立繪（含縮圖）
    const defWrap = document.createElement("div");
    defWrap.className = "char-field";
    defWrap.appendChild(subLabel("預設立繪"));
    const defRow = document.createElement("div");
    defRow.className = "char-thumb-row";
    const defImg = document.createElement("img");
    this.#fillThumb(defImg, data.default);
    defRow.appendChild(defImg);
    const defInput = datalistInput({
      value: data.default || "",
      options: charResources,
      placeholder: "檔名，例 alice_normal.png",
      onChange: (v) => {
        data.default = v;
        this.#write(() => this.project.upsertCharacter(name, data));
        this.#fillThumb(defImg, v);   // 立即換縮圖
      }
    });
    defRow.appendChild(defInput);
    defWrap.appendChild(defRow);
    detail.appendChild(defWrap);

    // 表情差分牆
    const emoSection = document.createElement("div");
    emoSection.className = "char-emotions";
    const emoTitle = document.createElement("div");
    emoTitle.className = "char-section-label";
    emoTitle.textContent = "表情";
    emoSection.appendChild(emoTitle);

    const emoGrid = document.createElement("div");
    emoGrid.className = "emotion-grid";
    const emotions = data.emotions || {};
    for (const [emoName, emoFile] of Object.entries(emotions)) {
      emoGrid.appendChild(this.#renderEmotionCard(name, data, emoName, emoFile, charResources));
    }
    if (Object.keys(emotions).length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "尚未定義表情差分";
      emoGrid.appendChild(empty);
    }
    emoSection.appendChild(emoGrid);

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
      this.#write(() => this.project.upsertCharacter(name, data));
      this.render();
    });
    emoSection.appendChild(addEmoBtn);
    detail.appendChild(emoSection);

    return detail;
  }

  #renderEmotionCard(charName, charData, emoName, emoFile, charResources) {
    const card = document.createElement("div");
    card.className = "emotion-card";

    const thumb = document.createElement("img");
    thumb.classList.add("emotion-card-thumb");
    this.#fillThumb(thumb, emoFile);
    card.appendChild(thumb);

    const nameRow = document.createElement("div");
    nameRow.className = "emotion-card-name";
    const label = document.createElement("span");
    label.textContent = emoName;
    nameRow.appendChild(label);
    const delBtn = document.createElement("button");
    delBtn.className = "emotion-delete";
    delBtn.textContent = "×";
    delBtn.title = "刪除表情";
    delBtn.addEventListener("click", () => {
      delete charData.emotions[emoName];
      this.#write(() => this.project.upsertCharacter(charName, charData));
      card.remove();
    });
    nameRow.appendChild(delBtn);
    card.appendChild(nameRow);

    const input = datalistInput({
      value: emoFile || "",
      options: charResources,
      placeholder: "檔名",
      onChange: (v) => {
        charData.emotions[emoName] = v;
        this.#write(() => this.project.upsertCharacter(charName, charData));
        this.#fillThumb(thumb, v);   // 立即換縮圖
      }
    });
    card.appendChild(input);

    return card;
  }
}
