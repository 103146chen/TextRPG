// ============================================
// ChapterManager.js
// 章節管理專頁（常駐於「敘事地圖」頁的「章節」分頁）。
// 把場景以拖曳分配到章節、章節內排序、移出到「未分類」。
// 資料模型：story.json 的 chapters:[{id,title,scenes:[sceneId...]}]，
// 場景檔本身不動；未列入任何章節的場景視為未分類。
// ============================================

import { escapeHtml, subLabel } from "../widgets/formFields.js";
import { promptDialog } from "../widgets/dialog.js";

const EVENTS = new Set([
  "loaded", "chapters-updated", "story-meta-updated", "undo", "redo",
  "scene-created", "scene-deleted", "scene-renamed",
]);

export class ChapterManager {
  constructor(containerEl, project, onOpenScene) {
    this.containerEl = containerEl;
    this.project = project;
    this.onOpenScene = onOpenScene;
    this._dragId = null;
    this._unsub = project.subscribe((t) => {
      if (EVENTS.has(t)) this.render();
    });
    this.render();
  }

  destroy() { this._unsub?.(); this.containerEl.innerHTML = ""; }

  #sceneTitle(id) {
    return this.project.getScene(id)?.meta.title || id;
  }

  render() {
    this.containerEl.innerHTML = "";
    if (!this.project.storyMeta) {
      this.containerEl.innerHTML = `<div class="asset-empty">開啟專案後可在此管理章節</div>`;
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "chapter-mgr";

    const intro = subLabel("拖曳場景卡到章節、或在章節內重排；拖到「未分類」即移出章節。章節只影響側欄分組與閱讀順序，不改動場景檔。");
    intro.style.display = "block";
    intro.style.marginBottom = "12px";
    wrap.appendChild(intro);

    const chapters = this.project.getChapters();
    chapters.forEach((ch, i) => {
      wrap.appendChild(this.#renderChapterCard(ch, i, chapters.length));
    });

    // 未分類場景
    const assigned = new Set(chapters.flatMap((c) => c.scenes || []));
    const unassigned = this.project.getAllSceneIds().filter((id) => !assigned.has(id));
    wrap.appendChild(this.#renderUnassigned(unassigned));

    // 新增章節
    const addBtn = document.createElement("button");
    addBtn.className = "tb-btn chapter-add";
    addBtn.textContent = "+ 新增章節";
    addBtn.addEventListener("click", async () => {
      const title = await promptDialog({
        title: "新增章節",
        label: "章節名稱",
        placeholder: "例：第一章 · 相遇",
        validate: (v) => {
          if (!v.trim()) return "請輸入章節名稱";
          if (this.project.getChapters().some((c) => c.id === v.trim())) return "章節已存在";
          return null;
        },
      });
      if (title === null) return;
      const id = title.trim();
      this.project.upsertChapter({ id, title: id, scenes: [] });
    });
    wrap.appendChild(addBtn);

    this.containerEl.appendChild(wrap);
  }

  #renderChapterCard(ch, index, total) {
    const card = document.createElement("div");
    card.className = "chapter-card";

    const head = document.createElement("div");
    head.className = "chapter-card-head";

    const order = document.createElement("div");
    order.className = "chapter-order";
    const up = document.createElement("button");
    up.className = "chapter-order-btn"; up.textContent = "▲"; up.title = "上移";
    up.disabled = index === 0;
    up.addEventListener("click", () => this.project.moveChapter(ch.id, -1));
    const down = document.createElement("button");
    down.className = "chapter-order-btn"; down.textContent = "▼"; down.title = "下移";
    down.disabled = index === total - 1;
    down.addEventListener("click", () => this.project.moveChapter(ch.id, +1));
    order.append(up, down);
    head.appendChild(order);

    const title = document.createElement("strong");
    title.className = "chapter-title";
    title.textContent = ch.title || ch.id;
    head.appendChild(title);

    const count = document.createElement("span");
    count.className = "chapter-count";
    count.textContent = `${(ch.scenes || []).length} 場`;
    head.appendChild(count);

    const renameBtn = document.createElement("button");
    renameBtn.className = "chapter-head-btn";
    renameBtn.textContent = "✎"; renameBtn.title = "重新命名";
    renameBtn.addEventListener("click", async () => {
      const newTitle = await promptDialog({
        title: "重新命名章節",
        label: "章節名稱",
        value: ch.title || ch.id,
        validate: (v) => !v.trim() ? "請輸入章節名稱" : null,
      });
      if (newTitle === null) return;
      this.project.upsertChapter({ id: ch.id, title: newTitle.trim() });
    });
    head.appendChild(renameBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "chapter-head-btn danger";
    delBtn.textContent = "×"; delBtn.title = "刪除章節（場景會回到未分類）";
    delBtn.addEventListener("click", () => {
      if (!confirm(`刪除章節「${ch.title || ch.id}」？\n章節內的場景會回到「未分類」，場景檔不受影響。`)) return;
      this.project.removeChapter(ch.id);
    });
    head.appendChild(delBtn);

    card.appendChild(head);
    card.appendChild(this.#renderSceneList(ch.scenes || [], ch.id));
    return card;
  }

  #renderUnassigned(ids) {
    const card = document.createElement("div");
    card.className = "chapter-card chapter-unassigned";
    const head = document.createElement("div");
    head.className = "chapter-card-head";
    head.innerHTML = `<strong class="chapter-title">未分類場景</strong><span class="chapter-count">${ids.length} 場</span>`;
    card.appendChild(head);
    card.appendChild(this.#renderSceneList(ids, ""));
    return card;
  }

  // chapterId = "" 代表未分類的落點
  #renderSceneList(sceneIds, chapterId) {
    const list = document.createElement("div");
    list.className = "chapter-scene-list";
    list.dataset.chapter = chapterId;

    for (const id of sceneIds) list.appendChild(this.#renderSceneItem(id));
    if (sceneIds.length === 0) {
      const hint = document.createElement("div");
      hint.className = "chapter-drop-hint";
      hint.textContent = "拖曳場景到這裡";
      list.appendChild(hint);
    }

    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      list.classList.add("drop-target");
    });
    list.addEventListener("dragleave", (e) => {
      if (e.target === list) list.classList.remove("drop-target");
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.classList.remove("drop-target");
      if (!this._dragId) return;
      const index = this.#dropIndex(list, e.clientY);
      this.project.moveScene(this._dragId, chapterId || null, index);
      this._dragId = null;
    });

    return list;
  }

  #renderSceneItem(id) {
    const item = document.createElement("div");
    item.className = "chapter-scene-item";
    item.draggable = true;
    item.dataset.sceneId = id;

    const grip = document.createElement("span");
    grip.className = "chapter-scene-grip";
    grip.textContent = "⋮⋮";
    item.appendChild(grip);

    const label = document.createElement("span");
    label.className = "chapter-scene-label";
    label.textContent = this.#sceneTitle(id);
    item.appendChild(label);

    const idTag = document.createElement("span");
    idTag.className = "chapter-scene-id";
    idTag.textContent = id;
    item.appendChild(idTag);

    item.addEventListener("dragstart", (e) => {
      this._dragId = id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      this._dragId = null;
      item.classList.remove("dragging");
    });
    // 點標題（非拖曳）開啟該場景
    label.addEventListener("click", () => this.onOpenScene?.(id));

    return item;
  }

  // 依游標 Y 求插入位置：第一個中線在游標下方的項目之前
  #dropIndex(list, clientY) {
    const items = [...list.querySelectorAll(".chapter-scene-item:not(.dragging)")];
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return items.length;
  }
}
