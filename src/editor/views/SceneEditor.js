// ============================================
// SceneEditor.js
// 場景內容編輯器：指令清單 + 場景 metadata 編輯
// ============================================

import { InstructionRow } from "../widgets/InstructionRow.js";
import { createSelectField } from "../widgets/selectField.js";

export class SceneEditor {
  constructor(containerEl, project, onPlayFrom = null, onManage = null, onSelect = null) {
    this.containerEl = containerEl;
    this.project = project;
    this.onPlayFrom = onPlayFrom;   // (sceneId, index) => void，實際播放
    this.onManage = onManage;       // (tab) => void，跳到對應的管理分頁
    this.onSelect = onSelect;       // (sceneId, index) => void，選取指令（靜態預覽跟隨）
    this.selectedIndex = null;
    this.currentSceneId = null;
    this.openMenu = null;
    this._pendingScrollTo = null;

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
    if (sceneId !== this.currentSceneId) this.selectedIndex = null;
    this.currentSceneId = sceneId;
    this.render();
    // 開場景時預覽跳到開頭（靜態）
    if (this.onSelect && sceneId) this.onSelect(sceneId, this.selectedIndex ?? 0);
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

    this.containerEl.innerHTML = "";
    this.#renderHeader(scene);
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
      onChange: (v) => {
        if (v !== scene.meta.id && v) {
          if (!confirm(`將場景 ID 從「${scene.meta.id}」改為「${v}」？\n這也會連動修改所有引用到它的 goto/next。`)) return;
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
  }

  #renderBody(scene) {
    const body = document.createElement("div");
    body.className = "scene-body";

    const list = document.createElement("div");
    list.className = "instr-list";

    // 頂部插入點
    list.appendChild(this.#makeInsertPoint(0));

    // 計算縮排
    let indent = 0;
    scene.instructions.forEach((ins, idx) => {
      // else/elif/endif 先降排縮
      if (ins.type === "elif" || ins.type === "else" || ins.type === "endif") {
        indent = Math.max(0, indent - 1);
      }

      const row = new InstructionRow({
        instruction: ins,
        index: idx,
        indent,
        project: this.project,
        sceneId: this.currentSceneId,
        selected: this.selectedIndex === idx,
        onSelect: () => this.selectInstruction(idx),
        onChange: (patch) => this.project.updateInstruction(this.currentSceneId, idx, patch),
        onDelete: () => this.project.deleteInstruction(this.currentSceneId, idx),
        onPlayFrom: this.onPlayFrom ? (index) => this.onPlayFrom(this.currentSceneId, index) : null,
        onManage: this.onManage,
      });
      list.appendChild(row.render());

      // if/elif/else 之後升排縮
      if (ins.type === "if" || ins.type === "elif" || ins.type === "else") {
        indent++;
      }

      // 每條指令後的插入點
      list.appendChild(this.#makeInsertPoint(idx + 1));
    });

    // 空場景提示
    if (scene.instructions.length === 0) {
      const hint = document.createElement("div");
      hint.style.textAlign = "center";
      hint.style.padding = "40px";
      hint.style.color = "var(--e-text-faded)";
      hint.innerHTML = "這個場景還沒有內容。<br>點擊上方的 <strong>＋</strong> 圖示開始加入指令。";
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
      const tpl = item.template();
      this.selectedIndex = index;   // 新列自動選取：預覽與檢查器跟著跳過去
      if (Array.isArray(tpl)) {
        tpl.forEach((t, i) => {
          this._pendingScrollTo = index;
          this.project.insertInstruction(this.currentSceneId, index + i, t);
        });
      } else {
        this._pendingScrollTo = index;
        this.project.insertInstruction(this.currentSceneId, index, tpl);
      }
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
