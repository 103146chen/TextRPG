// ============================================
// SceneEditor.js
// 場景內容編輯器：指令清單 + 場景 metadata 編輯
// ============================================

import { InstructionRow } from "../widgets/InstructionRow.js";

export class SceneEditor {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this.currentSceneId = null;
    this.openMenu = null;

    // 關閉插入選單（點到選單外）
    document.addEventListener("click", (e) => {
      if (this.openMenu && !this.openMenu.contains(e.target)) {
        this.closeInsertMenu();
      }
    });
  }

  openScene(sceneId) {
    this.currentSceneId = sceneId;
    this.render();
  }

  render() {
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
    const bgSelect = this.#selectWithDatalist({
      value: scene.meta.background || "",
      options: this.project.resources.backgrounds,
      placeholder: "背景檔名",
      onChange: (v) => this.project.updateSceneMeta(this.currentSceneId, { background: v }),
    });
    header.appendChild(this.#field("背景", bgSelect));

    // BGM
    const bgmSelect = this.#selectWithDatalist({
      value: scene.meta.bgm || "",
      options: this.project.resources.bgm,
      placeholder: "BGM 檔名",
      onChange: (v) => this.project.updateSceneMeta(this.currentSceneId, { bgm: v }),
    });
    header.appendChild(this.#field("BGM", bgmSelect));

    // Next
    const nextSelect = this.#selectWithDatalist({
      value: scene.meta.next || "",
      options: this.project.getAllSceneIds().filter(id => id !== this.currentSceneId),
      placeholder: "（無）",
      onChange: (v) => this.project.updateSceneMeta(this.currentSceneId, { next: v || undefined }),
    });
    header.appendChild(this.#field("下一場景", nextSelect));

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
        onChange: (patch) => this.project.updateInstruction(this.currentSceneId, idx, patch),
        onDelete: () => this.project.deleteInstruction(this.currentSceneId, idx),
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

    const items = [
      { kind: "text-dialog", label: "對話", color: "var(--e-blue)", template: () => ({ type: "text", speaker: "", text: "" }) },
      { kind: "text-narration", label: "旁白", color: "var(--e-text-dim)", template: () => ({ type: "text", speaker: "", text: "" }) },
      "divider",
      { kind: "show", label: "顯示立繪", color: "var(--e-accent)", template: () => ({ type: "directive", name: "show", args: { positional: ["", "center", ""] } }) },
      { kind: "hide", label: "隱藏立繪", color: "var(--e-accent)", template: () => ({ type: "directive", name: "hide", args: { positional: ["all"] } }) },
      { kind: "bg", label: "切換背景", color: "var(--e-accent)", template: () => ({ type: "directive", name: "bg", args: { positional: [""], fade: 800 } }) },
      { kind: "bgm", label: "BGM", color: "var(--e-accent)", template: () => ({ type: "directive", name: "bgm", args: { positional: [""] } }) },
      { kind: "wait", label: "等待", color: "var(--e-accent)", template: () => ({ type: "directive", name: "wait", args: { positional: [1000] } }) },
      "divider",
      { kind: "choice", label: "選項", color: "var(--e-accent-2)", template: () => ({ type: "choice", options: [{ text: "", set: {}, goto: "" }, { text: "", set: {}, goto: "" }] }) },
      { kind: "if", label: "條件 if", color: "var(--e-purple)", template: () => [{ type: "if", condition: "" }, { type: "endif" }] },
      { kind: "if-else", label: "條件 if-else", color: "var(--e-purple)", template: () => [{ type: "if", condition: "" }, { type: "else" }, { type: "endif" }] },
      { kind: "elif", label: "elif (加入 if 內)", color: "var(--e-purple)", template: () => ({ type: "elif", condition: "" }) },
      { kind: "else", label: "else (加入 if 內)", color: "var(--e-purple)", template: () => ({ type: "else" }) },
      { kind: "label", label: "標籤 (goto 用)", color: "var(--e-green)", template: () => ({ type: "label", name: "" }) },
      "divider",
      { kind: "set", label: "設定 flag", color: "var(--e-pink)", template: () => ({ type: "set", key: "", op: "=", value: true }) },
      { kind: "goto", label: "跳轉", color: "var(--e-purple)", template: () => ({ type: "goto", target: "" }) },
      { kind: "ending", label: "結局", color: "var(--e-green)", template: () => ({ type: "ending", id: "", title: "", desc: "" }) },
    ];

    for (const item of items) {
      if (item === "divider") {
        const d = document.createElement("div");
        d.className = "insert-menu-divider";
        menu.appendChild(d);
        continue;
      }
      const btn = document.createElement("button");
      btn.className = "insert-menu-item";
      btn.innerHTML = `
        <span class="kind-dot" style="background:${item.color}"></span>
        <span>${item.label}</span>
        <span class="kind-label">${item.kind}</span>
      `;
      btn.addEventListener("click", () => {
        const tpl = item.template();
        if (Array.isArray(tpl)) {
          // 多指令一次插入（例如 if ... endif 一組）
          tpl.forEach((t, i) => this.project.insertInstruction(this.currentSceneId, index + i, t));
        } else {
          this.project.insertInstruction(this.currentSceneId, index, tpl);
        }
        this.closeInsertMenu();
      });
      menu.appendChild(btn);
    }

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
    if (this.openMenu) {
      this.openMenu.remove();
      this.openMenu = null;
    }
  }

  // ============ 拖曳排序 ============

  #enableDragSort(listEl) {
    const rows = listEl.querySelectorAll(".instr-row");
    rows.forEach(row => {
      const handle = row.querySelector(".instr-handle");
      if (!handle) return;
      handle.draggable = true;
      handle.addEventListener("dragstart", (e) => {
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.dataset.index);
      });
      handle.addEventListener("dragend", () => {
        row.classList.remove("dragging");
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const toIdx = parseInt(row.dataset.index, 10);
        if (fromIdx !== toIdx) {
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
