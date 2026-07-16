// ============================================
// ProjectSettings.js
// 專案基本資訊：標題／副標題／作者／版本／起始場景。
// 常駐於「設定」頁。原為資料庫 Hub 的「基本資訊」分頁。
// ============================================

import { field, textInput } from "../widgets/formFields.js";

const EVENTS = new Set([
  "loaded", "story-meta-updated", "undo", "redo",
  // 起始場景下拉的選項來自場景清單
  "scene-created", "scene-deleted", "scene-renamed", "scene-meta-updated",
]);

export class ProjectSettings {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this._writing = false;
    this._unsub = project.subscribe((t) => {
      if (this._writing) return;
      if (EVENTS.has(t)) this.render();
    });
    this.render();
  }

  destroy() { this._unsub?.(); this.containerEl.innerHTML = ""; }

  #write(fn) { this._writing = true; try { fn(); } finally { this._writing = false; } }

  render() {
    this.containerEl.innerHTML = "";
    const meta = this.project.storyMeta;

    if (!meta) {
      this.containerEl.innerHTML = `<p class="muted">開啟專案後可在此編輯專案資訊。</p>`;
      return;
    }

    const patch = (partial) => this.#write(() => this.project.updateStoryMeta(partial));

    this.containerEl.appendChild(field("故事 ID", textInput({
      value: meta.id || "",
      placeholder: "my_story",
      readonly: true,
      help: "由資料夾名稱決定，不能修改",
    })));

    this.containerEl.appendChild(field("標題", textInput({
      value: meta.title || "",
      placeholder: "故事標題",
      onChange: (v) => patch({ title: v }),
    })));

    this.containerEl.appendChild(field("副標題", textInput({
      value: meta.subtitle || "",
      placeholder: "副標題（選用）",
      onChange: (v) => patch({ subtitle: v || undefined }),
    })));

    this.containerEl.appendChild(field("作者", textInput({
      value: meta.author || "",
      placeholder: "作者名",
      onChange: (v) => patch({ author: v || undefined }),
    })));

    this.containerEl.appendChild(field("版本", textInput({
      value: meta.version || "1.0.0",
      placeholder: "1.0.0",
      onChange: (v) => patch({ version: v || undefined }),
    })));

    // 起始場景
    const sceneIds = this.project.getAllSceneIds();
    const startSelect = document.createElement("select");
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "（選擇起始場景）";
    startSelect.appendChild(emptyOpt);
    for (const id of sceneIds) {
      const opt = document.createElement("option");
      opt.value = id;
      const sc = this.project.getScene(id);
      opt.textContent = sc.meta.title ? `${sc.meta.title} (${id})` : id;
      if (id === meta.start) opt.selected = true;
      startSelect.appendChild(opt);
    }
    startSelect.addEventListener("change", () => patch({ start: startSelect.value }));
    this.containerEl.appendChild(field("起始場景", startSelect));
  }
}
