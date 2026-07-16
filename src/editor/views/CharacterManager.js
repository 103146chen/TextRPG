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

// 只關心會改變本面板內容的事件（縮圖要重新讀 blob，重繪不便宜）
const EVENTS = new Set(["loaded", "characters-updated", "resources-updated", "undo", "redo"]);

export class CharacterManager {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this._thumbUrls = [];   // 縮圖 objectURL，重繪／卸載時撤銷
    this._writing = false;
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

    const wrap = document.createElement("div");
    wrap.className = "mgr-panel";

    const intro = subLabel("定義角色與表情差分後，劇本的 @show 可用「角色名 位置 表情」切換立繪。");
    intro.style.display = "block";
    intro.style.marginBottom = "12px";
    wrap.appendChild(intro);

    const chars = this.project.storyMeta.characters || {};
    const charList = document.createElement("div");
    charList.className = "char-list";

    for (const [name, data] of Object.entries(chars)) {
      charList.appendChild(this.#renderCharacterRow(name, data));
    }
    if (Object.keys(chars).length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "還沒定義任何角色";
      charList.appendChild(empty);
    }
    wrap.appendChild(charList);

    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn";
    addBtn.textContent = "+ 新增角色";
    addBtn.style.marginTop = "16px";
    addBtn.addEventListener("click", () => {
      const name = prompt("新角色的名稱：", "");
      if (!name) return;
      if ((this.project.storyMeta.characters || {})[name]) { alert("角色已存在"); return; }
      this.#write(() => this.project.upsertCharacter(name, { default: "", emotions: {} }));
      this.render();   // 結構變了，整面重繪
    });
    wrap.appendChild(addBtn);

    this.containerEl.appendChild(wrap);
  }

  #renderCharacterRow(name, data) {
    const row = document.createElement("div");
    row.className = "char-row";
    const charResources = this.project.resources.characters;

    // 名字 + 刪除按鈕
    const header = document.createElement("div");
    header.className = "char-row-header";
    header.innerHTML = `
      <strong class="char-name">${escapeHtml(name)}</strong>
      <button class="char-delete" title="刪除角色">×</button>
    `;
    header.querySelector(".char-delete").addEventListener("click", () => {
      if (!confirm(`刪除角色「${name}」？\n這不會刪除劇本中對這個角色的引用。`)) return;
      this.#write(() => this.project.removeCharacter(name));
      this.render();
    });
    row.appendChild(header);

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
    row.appendChild(defWrap);

    // 表情清單
    const emoSection = document.createElement("div");
    emoSection.className = "char-emotions";
    const emoTitle = document.createElement("div");
    emoTitle.className = "char-section-label";
    emoTitle.textContent = "表情";
    emoSection.appendChild(emoTitle);

    const emoList = document.createElement("div");
    emoList.className = "emotion-list";
    for (const [emoName, emoFile] of Object.entries(data.emotions || {})) {
      emoList.appendChild(this.#renderEmotionRow(name, data, emoName, emoFile, charResources));
    }
    emoSection.appendChild(emoList);

    const addEmoBtn = document.createElement("button");
    addEmoBtn.className = "emotion-add";
    addEmoBtn.textContent = "+ 新表情";
    addEmoBtn.addEventListener("click", () => {
      const emoName = prompt("表情名稱（例：happy、sad）：", "");
      if (!emoName) return;
      if (!data.emotions) data.emotions = {};
      if (data.emotions[emoName]) { alert("這個表情已存在"); return; }
      data.emotions[emoName] = "";
      this.#write(() => this.project.upsertCharacter(name, data));
      this.render();
    });
    emoSection.appendChild(addEmoBtn);
    row.appendChild(emoSection);

    return row;
  }

  #renderEmotionRow(charName, charData, emoName, emoFile, charResources) {
    const row = document.createElement("div");
    row.className = "emotion-row";

    const thumb = document.createElement("img");
    this.#fillThumb(thumb, emoFile);
    row.appendChild(thumb);

    const label = document.createElement("span");
    label.className = "emotion-name";
    label.textContent = emoName;
    row.appendChild(label);

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
    input.style.flex = "1";
    row.appendChild(input);

    const delBtn = document.createElement("button");
    delBtn.className = "emotion-delete";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => {
      delete charData.emotions[emoName];
      this.#write(() => this.project.upsertCharacter(charName, charData));
      row.remove();
    });
    row.appendChild(delBtn);

    return row;
  }
}
