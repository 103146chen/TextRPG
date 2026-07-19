// ============================================
// SceneEditor.js
// 場景內容編輯器：指令清單 + 場景 metadata 編輯
// ============================================

import { InstructionRow } from "../widgets/InstructionRow.js";
import { createSelectField } from "../widgets/selectField.js";
import { confirmDialog, promptDialog } from "../widgets/dialog.js";
import { collectLandmarks, openOutlinePalette } from "../widgets/outlinePalette.js";

export class SceneEditor {
  constructor(containerEl, project, onPlayFrom = null, onManage = null, onSelect = null) {
    this.containerEl = containerEl;
    this.project = project;
    this.onPlayFrom = onPlayFrom;   // (sceneId, index) => void，實際播放
    this.onManage = onManage;       // (tab) => void，跳到對應的管理分頁
    this.onSelect = onSelect;       // (sceneId, index) => void，選取指令（靜態預覽跟隨）
    this.selectedIndex = null;
    this.currentSceneId = null;
    // 分頁：第一個永遠是場景主線，其餘是開啟中的具名內容區塊。
    // 分頁只是「看同一個指令陣列的哪一段」，列上的 index 一律是真實索引，
    // 所以增刪／拖曳／從這裡試玩全部沿用原本的邏輯，不需要換算。
    this.tabs = [{ kind: "scene" }];
    this.activeTab = 0;
    this.openMenu = null;
    this._pendingScrollTo = null;
    this._pendingFocus = null;

    // 關閉插入選單（點到選單外）
    document.addEventListener("click", (e) => {
      const inMain = this.openMenu && this.openMenu.contains(e.target);
      const inSub = this.subMenu && this.subMenu.contains(e.target);
      if (this.openMenu && !inMain && !inSub) {
        this.closeInsertMenu();
      }
    });
  }

  openScene(sceneId) {
    if (sceneId !== this.currentSceneId) {
      this.selectedIndex = null;
      // 區塊分頁屬於某個場景，換場景就不該留著
      this.tabs = [{ kind: "scene" }];
      this.activeTab = 0;
    }
    this.currentSceneId = sceneId;
    this.render();
    // 開場景時預覽跳到開頭（靜態）
    if (this.onSelect && sceneId) this.onSelect(sceneId, this.selectedIndex ?? 0);
  }

  /**
   * 開啟場景大綱並跳到選中的地標。
   * 目標若在某個內容區塊裡，先切到該區塊的分頁——否則主線分頁上根本沒有那一列，
   * 跳過去會像什麼都沒發生。
   */
  async openOutline() {
    const scene = this.currentSceneId && this.project.getScene(this.currentSceneId);
    if (!scene) return;

    const picked = await openOutlinePalette(collectLandmarks(scene.instructions), {
      currentIndex: this.selectedIndex,
    });
    if (!picked) return;

    if (picked.inBlock) this.openBlockTab(picked.inBlock);
    else if (this.activeTab !== 0) { this.activeTab = 0; this.render(); }

    this.selectedIndex = picked.index;
    this._pendingScrollTo = picked.index;
    this.render();
    this.onSelect?.(this.currentSceneId, picked.index);
  }

  // ============ 分頁 ============

  /** 開啟（或切換到）某個具名區塊的分頁 */
  openBlockTab(name) {
    const existing = this.tabs.findIndex((t) => t.kind === "block" && t.name === name);
    if (existing >= 0) this.activeTab = existing;
    else {
      this.tabs.push({ kind: "block", name });
      this.activeTab = this.tabs.length - 1;
    }
    this.selectedIndex = null;
    this.render();
  }

  closeTab(i) {
    if (i === 0) return;                       // 場景主線分頁關不掉
    this.tabs.splice(i, 1);
    if (this.activeTab >= this.tabs.length) this.activeTab = this.tabs.length - 1;
    else if (this.activeTab > i) this.activeTab--;
    else if (this.activeTab === i) this.activeTab = 0;
    this.render();
  }

  /** 找出具名區塊的範圍：start=:: block 那列，end=:: endblock 那列 */
  #findBlock(scene, name) {
    const list = scene.instructions;
    const start = list.findIndex((x) => x.type === "block" && x.name === name);
    if (start < 0) return null;
    const end = list[start].endIndex ?? list.length;
    return { start, end };
  }

  /** 這個區塊被幾個選項用到（顯示在分頁標題列，方便判斷能不能改） */
  #blockRefCount(scene, name) {
    let n = 0;
    for (const ins of scene.instructions) {
      if (ins.type !== "choice") continue;
      n += (ins.options || []).filter((o) => o.do === name).length;
    }
    return n;
  }

  /**
   * 目前分頁要顯示哪些指令。
   * 回傳 { items, headInsertAt, tailInsertAt }；items 的 idx 是真實索引，
   * insertAfter 是「這一列後面的插入點該插到哪個真實索引」——主線分頁上
   * 區塊卡後面要插在 endblock 之後，不能插進區塊裡面。
   */
  #visibleItems(scene) {
    const list = scene.instructions;
    const tab = this.tabs[this.activeTab] || { kind: "scene" };

    if (tab.kind === "block") {
      const r = this.#findBlock(scene, tab.name);
      if (!r) return null;                     // 區塊被刪或改名 → 呼叫端退回主線
      const items = [];
      for (let i = r.start + 1; i < r.end; i++) items.push({ idx: i, insertAfter: i + 1 });
      return { items, headInsertAt: r.start + 1, tailInsertAt: r.end, range: r };
    }

    const items = [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].type === "block") {
        // 區塊在主線上只佔一張摘要卡，內容留給它自己的分頁
        const end = list[i].endIndex ?? list.length;
        items.push({ idx: i, insertAfter: end + 1 });
        i = end;
        continue;
      }
      items.push({ idx: i, insertAfter: i + 1 });
    }
    return { items, headInsertAt: 0, tailInsertAt: list.length };
  }

  #renderTabBar(scene) {
    // 只有一個分頁時不佔畫面
    if (this.tabs.length <= 1) return;

    const bar = document.createElement("div");
    bar.className = "editor-tabs";

    this.tabs.forEach((t, i) => {
      const tab = document.createElement("div");
      tab.className = "editor-tab" + (i === this.activeTab ? " active" : "");

      const label = document.createElement("button");
      label.className = "editor-tab-label";
      label.textContent = t.kind === "scene"
        ? (scene.meta.title || scene.meta.id)
        : `↳ ${t.name}`;
      label.addEventListener("click", () => {
        this.activeTab = i;
        this.selectedIndex = null;
        this.render();
      });
      tab.appendChild(label);

      if (i > 0) {
        const close = document.createElement("button");
        close.className = "editor-tab-close";
        close.textContent = "×";
        close.title = "關閉分頁";
        close.addEventListener("click", (e) => { e.stopPropagation(); this.closeTab(i); });
        tab.appendChild(close);
      }
      bar.appendChild(tab);
    });

    this.containerEl.appendChild(bar);
  }

  /** 區塊分頁的標題列：麵包屑 ＋ 被引用次數 ＋ 改名 */
  #renderBlockHeader(scene, name) {
    const header = document.createElement("div");
    header.className = "scene-header block-header";

    const h1 = document.createElement("h1");
    h1.textContent = `↳ ${name}`;
    header.appendChild(h1);

    const refs = this.#blockRefCount(scene, name);
    const badge = document.createElement("span");
    badge.className = "block-refs" + (refs === 0 ? " orphan" : "");
    // 0 次代表沒有任何選項會走到這裡——通常是改名或刪選項留下的孤兒
    badge.textContent = refs === 0 ? "沒有選項使用這個區塊" : `被 ${refs} 個選項使用`;
    header.appendChild(badge);

    const crumb = document.createElement("div");
    crumb.className = "block-crumb";
    crumb.textContent = `${scene.meta.title || scene.meta.id} ／ 內容區塊`;
    header.appendChild(crumb);

    header.appendChild(this.#field("區塊名稱", this.#input({
      value: name,
      onChange: (v) => {
        const next = v.trim();
        if (!next || next === name) return;
        this.#renameBlock(scene, name, next);
      },
    })));

    this.containerEl.appendChild(header);
  }

  /**
   * 替某個選項建立專屬內容區塊：在場景尾端新增 :: block / :: endblock，
   * 把選項的 set: 一併搬進去變成 @set（執行順序等價：原本也是 set 先於區塊），
   * 然後開啟它的分頁。
   */
  async #createBlockForOption(scene, choiceIdx, optIdx) {
    const choice = scene.instructions[choiceIdx];
    const opt = choice.options[optIdx];

    const name = await promptDialog({
      title: "建立內容區塊",
      label: "區塊名稱",
      value: this.#suggestBlockName(scene, opt.text),
      placeholder: "例：真誠認錯",
      validate: (v) => {
        const t = v.trim();
        if (!t) return "請輸入名稱";
        if (this.#findBlock(scene, t)) return "這個名稱已經有區塊了";
        return null;
      },
    });
    if (!name) return;
    const blockName = name.trim();

    // 選項的 set: 搬進區塊當開頭的 @set
    const setIns = Object.entries(opt.set || {}).map(([key, v]) => (
      v && typeof v === "object" && "op" in v
        ? { type: "set", key, op: v.op, value: v.value }
        : { type: "set", key, op: "=", value: v }
    ));

    const at = scene.instructions.length;
    this.project.insertInstruction(this.currentSceneId, at, { type: "block", name: blockName });
    setIns.forEach((s, i) =>
      this.project.insertInstruction(this.currentSceneId, at + 1 + i, s));
    this.project.insertInstruction(this.currentSceneId, at + 1 + setIns.length, { type: "endblock" });

    const options = [...choice.options];
    options[optIdx] = { ...options[optIdx], do: blockName, set: {} };
    this.project.updateInstruction(this.currentSceneId, choiceIdx, { options });

    this.openBlockTab(blockName);
  }

  /** 用選項文字當區塊名的預設值（去掉標點、太長就截斷、避開重複） */
  #suggestBlockName(scene, text) {
    let base = String(text || "").replace(/[「」『』（）()！？。，、,.!?\s]/g, "").slice(0, 12);
    if (!base) base = "內容區塊";
    let name = base, n = 2;
    while (this.#findBlock(scene, name)) name = `${base}${n++}`;
    return name;
  }

  /** 刪整個區塊（含內容與 endblock），並清掉指向它的 do: */
  async #deleteBlock(scene, blockIdx) {
    const ins = scene.instructions[blockIdx];
    const name = ins.name;
    const end = ins.endIndex ?? scene.instructions.length;
    const count = end - blockIdx + 1;
    const refs = this.#blockRefCount(scene, name);

    if (!(await confirmDialog({
      title: `刪除內容區塊「${name}」？`,
      message: refs > 0
        ? `這會連同區塊內的 ${count - 2} 條指令一起刪除，並清掉 ${refs} 個選項對它的指定（那些選項會變成直接接主線）。`
        : `這會連同區塊內的 ${count - 2} 條指令一起刪除。`,
      confirmText: "刪除",
    }))) return;

    // 先清 do:（用的是名稱，不受索引位移影響），再由後往前刪指令
    scene.instructions.forEach((x, i) => {
      if (x.type !== "choice") return;
      if (!(x.options || []).some((o) => o.do === name)) return;
      const options = x.options.map((o) => (o.do === name ? { ...o, do: undefined } : o));
      this.project.updateInstruction(this.currentSceneId, i, { options });
    });
    for (let i = end; i >= blockIdx; i--) {
      this.project.deleteInstruction(this.currentSceneId, i);
    }

    this.tabs = this.tabs.filter((t) => !(t.kind === "block" && t.name === name));
    this.activeTab = 0;
    this.render();
  }

  /** 改區塊名稱：連同所有 do: 一起改，否則選項會指到不存在的區塊 */
  #renameBlock(scene, oldName, newName) {
    const r = this.#findBlock(scene, oldName);
    if (!r) return;
    this.project.updateInstruction(this.currentSceneId, r.start, { name: newName });
    scene.instructions.forEach((ins, idx) => {
      if (ins.type !== "choice") return;
      if (!(ins.options || []).some((o) => o.do === oldName)) return;
      const options = ins.options.map((o) => (o.do === oldName ? { ...o, do: newName } : o));
      this.project.updateInstruction(this.currentSceneId, idx, { options });
    });
    const t = this.tabs[this.activeTab];
    if (t && t.kind === "block") t.name = newName;
    this.render();
  }

  /** 選取指令：更新樣式並通知宿主（帶動靜態預覽與檢查器） */
  selectInstruction(index) {
    if (this.selectedIndex === index) return;
    this.selectedIndex = index;
    this.containerEl.querySelectorAll(".instr-row").forEach((r) =>
      r.classList.toggle("selected", Number(r.dataset.index) === index));
    this.onSelect?.(this.currentSceneId, index);
  }

  render() {
    this.closeInsertMenu();
    const oldBody = this.containerEl.querySelector('.scene-body');
    const savedScroll = oldBody ? oldBody.scrollTop : 0;

    if (!this.currentSceneId) {
      this.containerEl.innerHTML = `
        <div class="main-empty">
          <div>
            <h2>請從左側選擇場景</h2>
            <p>或按上方工具列的「<code>+ 新場景</code>」建立新場景。</p>
          </div>
        </div>`;
      return;
    }

    const scene = this.project.getScene(this.currentSceneId);
    if (!scene) {
      this.containerEl.innerHTML = `<div class="main-empty">找不到場景</div>`;
      return;
    }

    // 分頁指向的區塊可能已被刪除／改名（例如在主線把整段刪掉）→ 退回主線
    let tab = this.tabs[this.activeTab] || { kind: "scene" };
    if (tab.kind === "block" && !this.#findBlock(scene, tab.name)) {
      this.tabs = this.tabs.filter((t) => t.kind === "scene" || this.#findBlock(scene, t.name));
      this.activeTab = 0;
      tab = this.tabs[0];
    }

    this.containerEl.innerHTML = "";
    this.#renderTabBar(scene);
    if (tab.kind === "block") this.#renderBlockHeader(scene, tab.name);
    else this.#renderHeader(scene);
    this.#renderBody(scene);

    const newBody = this.containerEl.querySelector('.scene-body');
    if (!newBody) return;

    // 先「同步」回到原本的捲動位置——若等 rAF 才處理，
    // 會先閃到頂端一幀，且 scrollIntoView 從 0 起算只會把列貼到底邊，
    // 檢視位置每插入一次就漂移一次（使用者回報的「新增後不維持位置」）。
    newBody.scrollTop = savedScroll;

    if (this._pendingScrollTo !== null) {
      const pending = this._pendingScrollTo;
      this._pendingScrollTo = null;
      requestAnimationFrame(() => {
        const idx = typeof pending === 'object' ? pending.index : pending;
        const targetRow = this.containerEl.querySelector(`.instr-row[data-index="${idx}"]`);
        if (!targetRow) return;

        if (typeof pending === 'object' && pending.visualOffset !== undefined) {
          // 還原拖曳時的視覺位置（以目前捲動為基準換算成容器內座標）
          const rowTop = targetRow.getBoundingClientRect().top;
          const bodyRect = newBody.getBoundingClientRect();
          newBody.scrollTop = newBody.scrollTop + (rowTop - bodyRect.top) - pending.visualOffset;
        } else {
          // 檢視位置已還原；只有目標列不在視野內時才輕移入視野
          const rowRect = targetRow.getBoundingClientRect();
          const bodyRect = newBody.getBoundingClientRect();
          if (rowRect.top < bodyRect.top || rowRect.bottom > bodyRect.bottom) {
            targetRow.scrollIntoView({ block: 'nearest' });
          }
        }
        // 高亮閃爍，方便定位
        targetRow.classList.remove('drop-highlight');
        void targetRow.offsetWidth; // 強制重排，確保動畫重新開始
        targetRow.classList.add('drop-highlight');
        targetRow.addEventListener('animationend',
          () => targetRow.classList.remove('drop-highlight'), { once: true });
      });
    }

    // 插入後把焦點落到新列，作者可以直接打字（不必再點一次）。
    // 這裡不用 rAF：重繪後 DOM 已就緒，可直接聚焦；而且 rAF 在背景分頁會被
    // 節流不觸發。preventScroll 交由上面的捲動邏輯決定視野，避免兩邊打架。
    if (this._pendingFocus !== null && this._pendingFocus !== undefined) {
      const fidx = this._pendingFocus;
      this._pendingFocus = null;
      this.focusRow(fidx);
    }
  }

  /** 把焦點放到某列的第一個可編輯欄位；對話列優先聚焦文字（最常要打的東西） */
  focusRow(index) {
    const row = this.containerEl.querySelector(`.instr-row[data-index="${index}"]`);
    if (!row) return;
    const el = row.querySelector(".dlg-text")
      || row.querySelector('.instr-content textarea, .instr-content input:not([type="checkbox"]):not([type="color"]):not([type="range"]), .instr-content select');
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.select === "function") { try { el.select(); } catch { /* select 不適用 */ } }
  }

  #renderHeader(scene) {
    const header = document.createElement("div");
    header.className = "scene-header";

    // 場景 ID（唯讀）
    const h1 = document.createElement("h1");
    h1.textContent = scene.meta.title || scene.meta.id;
    header.appendChild(h1);

    // 場景 ID 編輯
    header.appendChild(this.#field("ID", this.#input({
      value: scene.meta.id,
      onChange: async (v) => {
        if (v !== scene.meta.id && v) {
          if (!(await confirmDialog({
            title: `將場景 ID 改為「${v}」？`,
            message: `原 ID「${scene.meta.id}」。這也會連動修改所有引用到它的 goto/next。`,
            confirmText: "重新命名",
          }))) return;
          this.project.renameScene(scene.meta.id, v);
          this.currentSceneId = v;
        }
      }
    })));

    // Title
    header.appendChild(this.#field("標題", this.#input({
      value: scene.meta.title || "",
      placeholder: "場景標題",
      onChange: (v) => this.project.updateSceneMeta(this.currentSceneId, { title: v }),
    })));

    // Background
    const bgSelect = createSelectField({
      value: scene.meta.background || "",
      options: this.project.resources.backgrounds,
      placeholder: "（無背景）",
      addLabel: "匯入背景…", onAdd: () => this.onManage?.("asset-backgrounds"),
      onChange: (v) => this.project.updateSceneMeta(this.currentSceneId, { background: v }),
    });
    header.appendChild(this.#field("背景", bgSelect));

    // BGM
    const bgmSelect = createSelectField({
      value: scene.meta.bgm || "",
      options: this.project.resources.bgm,
      placeholder: "（無 BGM）",
      addLabel: "匯入 BGM…", onAdd: () => this.onManage?.("asset-bgm"),
      onChange: (v) => this.project.updateSceneMeta(this.currentSceneId, { bgm: v }),
    });
    header.appendChild(this.#field("BGM", bgmSelect));

    // Next
    const nextSelect = createSelectField({
      value: scene.meta.next || "",
      options: this.project.getAllSceneIds().filter(id => id !== this.currentSceneId),
      placeholder: "（無）",
      onChange: (v) => this.project.updateSceneMeta(this.currentSceneId, { next: v || undefined }),
    });
    header.appendChild(this.#field("下一場景", nextSelect));

    // 所屬章節（輕量分層：只改 story.json 的 chapters，場景檔不動）
    const chapterSelect = createSelectField({
      value: this.project.getSceneChapter(this.currentSceneId) || "",
      options: this.project.getChapters().map((c) => c.id),
      placeholder: "（未分類）",
      addLabel: "新增章節…", onAdd: () => this.onManage?.("chapters"),
      onChange: (v) => this.project.setSceneChapter(this.currentSceneId, v || null),
    });
    header.appendChild(this.#field("章節", chapterSelect));

    // 即時預覽此場景（從開頭）
    if (this.onPlayFrom) {
      const playBtn = document.createElement("button");
      playBtn.textContent = "▶ 預覽此場景";
      playBtn.title = "從本場景開頭即時預覽（含未存檔變更）";
      playBtn.style.cssText = "cursor:pointer;background:var(--e-accent,#4a90d9);color:#fff;border:0;border-radius:6px;padding:5px 12px;font-size:13px;align-self:center";
      playBtn.addEventListener("click", () => this.onPlayFrom(this.currentSceneId, 0));
      header.appendChild(playBtn);
    }

    this.containerEl.appendChild(header);
    this.containerEl.appendChild(this.#renderQuickBar(scene));
  }

  /**
   * 常用指令快速列：一鍵插入，省掉「＋ → 類別 → 項目」三次點擊。
   * 插入點是「選取列的下一列」，沒選取就接在場景末尾——與作者的視線一致。
   */
  #renderQuickBar(scene) {
    const bar = document.createElement("div");
    bar.className = "quick-bar";

    const label = document.createElement("span");
    label.className = "quick-bar-label";
    label.textContent = "快速插入";
    bar.appendChild(label);

    // 接在選取列之後；未選取則放到目前分頁的最後一列之後。
    // 用分頁的 tailInsertAt 而非整個場景的長度——在區塊分頁裡插入必須落在
    // endblock 前面，否則新指令會掉到區塊外面變成主線的一部分。
    const at = () => {
      if (this.selectedIndex != null) return this.selectedIndex + 1;
      return this.#visibleItems(scene)?.tailInsertAt ?? scene.instructions.length;
    };
    // 對話沿用「插入點之前最近一句對話」的說話者，接話不用重打名字
    const prevSpeaker = () => {
      for (let i = at() - 1; i >= 0; i--) {
        const ins = scene.instructions[i];
        if (ins?.type === "text" && ins.speaker) return ins.speaker;
      }
      return "";
    };

    const items = [
      ["對話", () => ({ type: "text", speaker: prevSpeaker(), text: "" })],
      ["旁白", () => ({ type: "text", speaker: "", text: "" })],
      ["立繪", () => ({ type: "directive", name: "show", args: { positional: ["", "center", ""] } })],
      ["隱藏", () => ({ type: "directive", name: "hide", args: { positional: ["all"] } })],
      ["背景", () => ({ type: "directive", name: "bg", args: { positional: [""], fade: 800 } })],
      ["選項", () => ({ type: "choice", options: [{ text: "", set: {}, goto: "" }, { text: "", set: {}, goto: "" }] })],
    ];
    for (const [text, tpl] of items) {
      const b = document.createElement("button");
      b.className = "quick-btn";
      b.textContent = text;
      b.title = `插入「${text}」到選取列的下一列`;
      b.addEventListener("click", () => this.insertTemplate(at(), tpl()));
      bar.appendChild(b);
    }

    // 大綱：純快捷鍵沒人找得到，這裡放一個看得見的入口
    const outline = document.createElement("button");
    outline.className = "quick-btn quick-outline";
    outline.textContent = "☰ 大綱";
    outline.title = "跳到選項／內容區塊／條件／背景切換（Ctrl+G）";
    outline.addEventListener("click", () => this.openOutline());
    bar.appendChild(outline);

    return bar;
  }

  #renderBody(scene) {
    const body = document.createElement("div");
    body.className = "scene-body";

    const list = document.createElement("div");
    list.className = "instr-list";

    const view = this.#visibleItems(scene);
    if (!view) return;

    // 頂部插入點
    list.appendChild(this.#makeInsertPoint(view.headInsertAt));

    // 計算縮排
    let indent = 0;
    view.items.forEach(({ idx, insertAfter }, pos) => {
      const ins = scene.instructions[idx];
      // else/elif/endif 先降排縮
      if (ins.type === "elif" || ins.type === "else" || ins.type === "endif") {
        indent = Math.max(0, indent - 1);
      }

      // 與上一句同一個說話者（含連續旁白）→ 收合重複的說話者列。
      // 比對的是「畫面上的前一列」，不是陣列的前一格——區塊分頁的第一列
      // 前面是 :: block，不該被當成接續。
      const prevIdx = view.items[pos - 1]?.idx;
      const prev = prevIdx != null ? scene.instructions[prevIdx] : null;
      const continuation = ins.type === "text" && prev?.type === "text"
        && (prev.speaker || "") === (ins.speaker || "");

      const row = new InstructionRow({
        instruction: ins,
        index: idx,
        indent,
        continuation,
        project: this.project,
        sceneId: this.currentSceneId,
        selected: this.selectedIndex === idx,
        onSelect: () => this.selectInstruction(idx),
        onChange: (patch) => this.project.updateInstruction(this.currentSceneId, idx, patch),
        // 區塊要整段刪：只刪 :: block 那行會把內容和 endblock 留在主線上，
        // 那些指令就會變成主線的一部分被播出來。
        onDelete: ins.type === "block"
          ? () => this.#deleteBlock(scene, idx)
          : () => this.project.deleteInstruction(this.currentSceneId, idx),
        onPlayFrom: this.onPlayFrom ? (index) => this.onPlayFrom(this.currentSceneId, index) : null,
        onManage: this.onManage,
        // 對話框按 Enter：在下一行接一句同說話者的台詞並聚焦
        onEnterContinue: (i, speaker) =>
          this.insertTemplate(i + 1, { type: "text", speaker, text: "" }),
        onOpenBlock: (name) => this.openBlockTab(name),
        onCreateBlock: (optIdx) => this.#createBlockForOption(scene, idx, optIdx),
      });
      list.appendChild(row.render());

      // if/elif/else 之後升排縮
      if (ins.type === "if" || ins.type === "elif" || ins.type === "else") {
        indent++;
      }

      // 每條指令後的插入點（區塊卡後面要插在 endblock 之後，不能插進區塊裡）
      list.appendChild(this.#makeInsertPoint(insertAfter));
    });

    // 空白提示
    if (view.items.length === 0) {
      const hint = document.createElement("div");
      hint.style.textAlign = "center";
      hint.style.padding = "40px";
      hint.style.color = "var(--e-text-faded)";
      hint.innerHTML = this.tabs[this.activeTab]?.kind === "block"
        ? "這個區塊還沒有內容。<br>點擊上方的 <strong>＋</strong> 圖示加入這個選項專屬的劇情。"
        : "這個場景還沒有內容。<br>點擊上方的 <strong>＋</strong> 圖示開始加入指令。";
      list.appendChild(hint);
    }

    body.appendChild(list);
    this.containerEl.appendChild(body);

    // 啟用拖曳排序
    this.#enableDragSort(list);
  }

  // ============ 插入點 ============

  #makeInsertPoint(index) {
    const point = document.createElement("div");
    point.className = "insert-point";
    point.dataset.index = index;      // 插入落點，供除錯／測試檢查
    const btn = document.createElement("button");
    btn.className = "insert-point-btn";
    btn.textContent = "+";
    btn.title = "插入指令";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openInsertMenu(btn, index);
    });
    point.appendChild(btn);
    return point;
  }

  openInsertMenu(anchor, index) {
    this.closeInsertMenu();
    const menu = document.createElement("div");
    menu.className = "insert-menu";

    // 二級分類：先選類別、右側挑指令（一級全攤太長，眼花撩亂）
    const CATEGORIES = [
      { label: "文字", items: [
        { kind: "text-dialog", label: "對話", color: "var(--e-blue)", template: () => ({ type: "text", speaker: "", text: "" }) },
        { kind: "text-narration", label: "旁白", color: "var(--e-text-dim)", template: () => ({ type: "text", speaker: "", text: "" }) },
        { kind: "comment", label: "註解（不會顯示）", color: "var(--e-green)", template: () => ({ type: "comment", text: "" }) },
        { kind: "float", label: "浮動文字", color: "var(--e-accent)", template: () => ({ type: "directive", name: "float", args: { positional: [""], x: 50, y: 40, duration: 1500 } }) },
      ]},
      { label: "立繪與背景", items: [
        { kind: "show", label: "顯示立繪", color: "var(--e-accent)", template: () => ({ type: "directive", name: "show", args: { positional: ["", "center", ""] } }) },
        { kind: "hide", label: "隱藏立繪", color: "var(--e-accent)", template: () => ({ type: "directive", name: "hide", args: { positional: ["all"] } }) },
        { kind: "bg", label: "切換背景", color: "var(--e-accent)", template: () => ({ type: "directive", name: "bg", args: { positional: [""], fade: 800 } }) },
        { kind: "sprite", label: "精靈動畫（跳/晃/移）", color: "var(--e-accent)", template: () => ({ type: "directive", name: "sprite", args: { positional: ["", "jump"], duration: 500 } }) },
      ]},
      { label: "音訊", items: [
        { kind: "bgm", label: "播放 BGM", color: "var(--e-accent)", template: () => ({ type: "directive", name: "bgm", args: { positional: [""] } }) },
        { kind: "bgm-stop", label: "停止 BGM", color: "var(--e-accent)", template: () => ({ type: "directive", name: "bgm-stop", args: { positional: [], fade: 500 } }) },
        { kind: "se", label: "音效", color: "var(--e-accent)", template: () => ({ type: "directive", name: "se", args: { positional: [""] } }) },
        { kind: "se-stop", label: "停止音效", color: "var(--e-accent)", template: () => ({ type: "directive", name: "se-stop", args: { positional: [] } }) },
        { kind: "voice", label: "語音（對話配音）", color: "var(--e-accent)", template: () => ({ type: "directive", name: "voice", args: { positional: [""] } }) },
      ]},
      { label: "節奏與界面", items: [
        { kind: "chapter", label: "章節標題卡", color: "var(--e-accent)", template: () => ({ type: "directive", name: "chapter", args: { positional: [], title: "第一章", subtitle: "", duration: 2500 } }) },
        { kind: "wait", label: "等待", color: "var(--e-accent)", template: () => ({ type: "directive", name: "wait", args: { positional: [1000] } }) },
        { kind: "auto", label: "自動播放", color: "var(--e-accent)", template: () => ({ type: "directive", name: "auto", args: { positional: ["on"], delay: 1500 } }) },
        { kind: "textcfg", label: "文本參數", color: "var(--e-accent)", template: () => ({ type: "directive", name: "textcfg", args: { positional: [], speed: 35 } }) },
        { kind: "ui", label: "顯示/隱藏界面", color: "var(--e-accent)", template: () => ({ type: "directive", name: "ui", args: { positional: ["hide"] } }) },
      ]},
      { label: "特效與鏡頭", items: [
        { kind: "shake", label: "震動螢幕", color: "var(--e-accent)", template: () => ({ type: "directive", name: "shake", args: { positional: [8], duration: 500 } }) },
        { kind: "flash", label: "閃光", color: "var(--e-accent)", template: () => ({ type: "directive", name: "flash", args: { positional: ["#ffffff"], duration: 400 } }) },
        { kind: "tint", label: "畫面染色", color: "var(--e-accent)", template: () => ({ type: "directive", name: "tint", args: { positional: ["#000000"], opacity: 0.4, duration: 600 } }) },
        { kind: "tint-clear", label: "清除染色", color: "var(--e-accent)", template: () => ({ type: "directive", name: "tint-clear", args: { positional: [], duration: 600 } }) },
        { kind: "curtain", label: "帷幕（合上/打開）", color: "var(--e-accent)", template: () => ({ type: "directive", name: "curtain", args: { positional: ["close"], color: "#000000", duration: 600 } }) },
        { kind: "camera", label: "鏡頭（縮放/位移/暗角）", color: "var(--e-accent)", template: () => ({ type: "directive", name: "camera", args: { positional: [], zoom: 1.2, duration: 800 } }) },
        { kind: "camera-reset", label: "復位鏡頭", color: "var(--e-accent)", template: () => ({ type: "directive", name: "camera-reset", args: { positional: [], duration: 800 } }) },
      ]},
      { label: "媒體", items: [
        { kind: "video", label: "播放視頻", color: "var(--e-accent)", template: () => ({ type: "directive", name: "video", args: { positional: [""] } }) },
        { kind: "video-stop", label: "停止視頻", color: "var(--e-accent)", template: () => ({ type: "directive", name: "video-stop", args: { positional: [] } }) },
        { kind: "particles", label: "粒子（雪/雨/花瓣）", color: "var(--e-accent)", template: () => ({ type: "directive", name: "particles", args: { positional: ["snow"] } }) },
        { kind: "particles-stop", label: "停止粒子", color: "var(--e-accent)", template: () => ({ type: "directive", name: "particles-stop", args: { positional: [] } }) },
        { kind: "clear", label: "銷毀場景（清空畫面）", color: "var(--e-accent)", template: () => ({ type: "directive", name: "clear", args: { positional: [], fade: 400 } }) },
      ]},
      { label: "流程", items: [
        { kind: "choice", label: "選項", color: "var(--e-accent-2)", template: () => ({ type: "choice", options: [{ text: "", set: {}, goto: "" }, { text: "", set: {}, goto: "" }] }) },
        { kind: "if", label: "條件 if", color: "var(--e-purple)", template: () => [{ type: "if", condition: "" }, { type: "endif" }] },
        { kind: "if-else", label: "條件 if-else", color: "var(--e-purple)", template: () => [{ type: "if", condition: "" }, { type: "else" }, { type: "endif" }] },
        { kind: "elif", label: "elif (加入 if 內)", color: "var(--e-purple)", template: () => ({ type: "elif", condition: "" }) },
        { kind: "else", label: "else (加入 if 內)", color: "var(--e-purple)", template: () => ({ type: "else" }) },
        { kind: "label", label: "標籤 (goto 用)", color: "var(--e-green)", template: () => ({ type: "label", name: "" }) },
        { kind: "goto", label: "跳轉", color: "var(--e-purple)", template: () => ({ type: "goto", target: "" }) },
        { kind: "ending", label: "結局", color: "var(--e-green)", template: () => ({ type: "ending", id: "", title: "", desc: "" }) },
      ]},
      { label: "資料", items: [
        { kind: "set", label: "設定 flag", color: "var(--e-pink)", template: () => ({ type: "set", key: "", op: "=", value: true }) },
      ]},
    ];

    // 飛出式：一級只放類別，子選單開在類別「右側」（沒空間就開左側），
    // 才不會發生「滑鼠斜向移過去、子選單被中途經過的類別搶走」點不到的問題。
    menu.classList.add("cats-only");
    const catCol = document.createElement("div");
    catCol.className = "im-cats";
    menu.appendChild(catCol);

    const insertItem = (item) => {
      this.insertTemplate(index, item.template());
      this.closeInsertMenu();
    };

    const openSub = (cat, cbtn) => {
      catCol.querySelectorAll(".im-cat").forEach((b) => b.classList.toggle("active", b === cbtn));
      this.subMenu?.remove();
      const sub = document.createElement("div");
      sub.className = "insert-menu insert-submenu";
      for (const item of cat.items) {
        const btn = document.createElement("button");
        btn.className = "insert-menu-item";
        btn.innerHTML = `
          <span class="kind-dot" style="background:${item.color}"></span>
          <span>${item.label}</span>
          <span class="kind-label">${item.kind}</span>
        `;
        btn.addEventListener("click", () => insertItem(item));
        sub.appendChild(btn);
      }
      document.body.appendChild(sub);

      // 定位：貼齊類別列右緣；右側放不下 → 開左側；垂直夾在視窗內
      const r = cbtn.getBoundingClientRect();
      const w = sub.offsetWidth;
      const h = sub.offsetHeight;
      let left = r.right + 2;
      if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 2);
      let top = r.top - 4;
      if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
      sub.style.left = `${left}px`;
      sub.style.top = `${top}px`;

      // 滑進子選單就取消待切換的計時器（防止殘留切換）
      sub.addEventListener("mouseenter", () => clearTimeout(this._subTimer));
      this.subMenu = sub;
    };

    CATEGORIES.forEach((cat) => {
      const cbtn = document.createElement("button");
      cbtn.className = "im-cat";
      cbtn.innerHTML = `<span>${cat.label}</span><span class="im-arrow">▸</span>`;
      // 懸停切換加 120ms 緩衝：斜向移往子選單時途經其他類別不會立刻搶走
      cbtn.addEventListener("mouseenter", () => {
        clearTimeout(this._subTimer);
        this._subTimer = setTimeout(() => openSub(cat, cbtn), 120);
      });
      cbtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearTimeout(this._subTimer);
        openSub(cat, cbtn);
      });
      catCol.appendChild(cbtn);
    });

    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    // 如果會超出下邊界，改往上開
    const menuHeight = menu.offsetHeight;
    if (rect.bottom + menuHeight > window.innerHeight) {
      menu.style.top = `${Math.max(10, rect.top - menuHeight - 6)}px`;
    }

    this.openMenu = menu;
  }

  /**
   * 在 index 位置插入指令（單筆或多筆），並讓新列自動選取、捲入視野、
   * 把輸入焦點落到第一個可編輯欄位——插入後可以直接開始打字。
   * 插入選單、快速工具列、對話 Enter 續行都走這裡。
   */
  insertTemplate(index, tpl) {
    if (!this.currentSceneId || !tpl) return;
    this.selectedIndex = index;    // 新列自動選取：預覽與檢查器跟著跳過去
    this._pendingScrollTo = index;
    this._pendingFocus = index;
    if (Array.isArray(tpl)) {
      tpl.forEach((t, i) => this.project.insertInstruction(this.currentSceneId, index + i, t));
    } else {
      this.project.insertInstruction(this.currentSceneId, index, tpl);
    }
  }

  closeInsertMenu() {
    clearTimeout(this._subTimer);
    if (this.subMenu) {
      this.subMenu.remove();
      this.subMenu = null;
    }
    if (this.openMenu) {
      this.openMenu.remove();
      this.openMenu = null;
    }
  }

  // ============ 拖曳排序 ============

  #enableDragSort(listEl) {
    const scrollContainer = listEl.parentElement; // .scene-body
    let draggedVisualOffset = 0;

    const clearIndicators = () => {
      listEl.querySelectorAll('.drop-above, .drop-below').forEach(r => {
        r.classList.remove('drop-above', 'drop-below');
      });
    };

    const rows = listEl.querySelectorAll(".instr-row");
    rows.forEach(row => {
      const handle = row.querySelector(".instr-handle");
      if (!handle) return;
      // 區塊在主線上只是一張摘要卡，拖它只會搬到 :: block 那一行，
      // 內容和 endblock 會被留在原地拆散。區塊之間也沒有順序意義，直接禁止拖曳。
      if (row.dataset.type === "block") { handle.remove(); return; }
      handle.draggable = true;
      handle.addEventListener("dragstart", (e) => {
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.dataset.index);
        // 記錄拖曳起始時，元素頂端距離捲動容器頂端的視覺偏移
        const rowRect = row.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        draggedVisualOffset = rowRect.top - containerRect.top;
      });
      handle.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        clearIndicators();
      });
      row.addEventListener("dragover", (e) => {
        if (row.classList.contains('dragging')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = row.getBoundingClientRect();
        const isAbove = e.clientY < rect.top + rect.height / 2;
        clearIndicators();
        row.classList.add(isAbove ? 'drop-above' : 'drop-below');
      });
      row.addEventListener("dragleave", (e) => {
        if (!row.contains(e.relatedTarget)) {
          row.classList.remove('drop-above', 'drop-below');
        }
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        clearIndicators();
        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const toIdx = parseInt(row.dataset.index, 10);
        if (fromIdx !== toIdx) {
          this._pendingScrollTo = { index: toIdx, visualOffset: draggedVisualOffset };
          this.project.moveInstruction(this.currentSceneId, fromIdx, toIdx);
        }
      });
    });
  }

  // ============ 工具方法 ============

  #field(label, input) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("span");
    lab.textContent = label;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  #input({ value, placeholder = "", onChange }) {
    const input = document.createElement("input");
    input.value = value ?? "";
    input.placeholder = placeholder;
    input.addEventListener("change", () => onChange(input.value));
    return input;
  }

  #selectWithDatalist({ value, options, placeholder, onChange }) {
    const wrap = document.createElement("span");
    wrap.style.display = "contents";
    const input = document.createElement("input");
    input.value = value || "";
    input.placeholder = placeholder;
    const dlId = `dl-${Math.random().toString(36).slice(2, 9)}`;
    input.setAttribute("list", dlId);
    const dl = document.createElement("datalist");
    dl.id = dlId;
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      dl.appendChild(o);
    }
    input.addEventListener("change", () => onChange(input.value));
    wrap.appendChild(input);
    wrap.appendChild(dl);
    return wrap;
  }
}
