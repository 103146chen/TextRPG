// ============================================
// ThemeEditor.js
// 個性化頁：編輯 story.json 的 theme（字體／文字框／配色），
// 右側即時範例文字框套用同一組 CSS 變數。存進 storyMeta.theme，發布後跟著走。
// ============================================

import { field } from "../widgets/formFields.js";
import { THEME_FIELDS, FONT_OPTIONS, applyTheme } from "../../ui/theme.js";

const EVENTS = new Set(["loaded", "story-meta-updated", "undo", "redo"]);

export class ThemeEditor {
  constructor(containerEl, project) {
    this.containerEl = containerEl;
    this.project = project;
    this._writing = false;
    this._sample = null;
    this._unsub = project.subscribe((t) => {
      if (this._writing) return;
      if (EVENTS.has(t)) this.render();
    });
    this.render();
  }

  destroy() { this._unsub?.(); this.containerEl.innerHTML = ""; }

  #write(fn) { this._writing = true; try { fn(); } finally { this._writing = false; } }

  get #theme() { return this.project.storyMeta?.theme || {}; }

  // 合併寫回一個 theme 欄位（空值＝清除該欄位，回到預設）
  #patch(key, value) {
    const theme = { ...this.#theme };
    if (value === "" || value == null) delete theme[key];
    else theme[key] = value;
    this.#write(() => this.project.updateStoryMeta({ theme: Object.keys(theme).length ? theme : undefined }));
    this.#applySample(theme);
  }

  #applySample(theme) {
    if (this._sample) applyTheme(theme || this.#theme, this._sample);
  }

  render() {
    this.containerEl.innerHTML = "";
    if (!this.project.storyMeta) {
      this.containerEl.innerHTML = `<p class="muted">開啟專案後可在此設定外觀主題。</p>`;
      return;
    }

    const theme = this.#theme;
    const wrap = document.createElement("div");
    wrap.className = "theme-grid";

    // ---- 左：控制項 ----
    const controls = document.createElement("div");
    controls.className = "theme-controls";
    for (const f of THEME_FIELDS) controls.appendChild(this.#renderField(f, theme));

    const reset = document.createElement("button");
    reset.className = "tb-btn";
    reset.textContent = "重設為預設外觀";
    reset.style.marginTop = "14px";
    reset.addEventListener("click", () => {
      this.#write(() => this.project.updateStoryMeta({ theme: undefined }));
      this.render();
    });
    controls.appendChild(reset);
    wrap.appendChild(controls);

    // ---- 右：即時範例 ----
    wrap.appendChild(this.#renderSample(theme));
    this.containerEl.appendChild(wrap);
  }

  #renderField(f, theme) {
    if (f.type === "font") {
      const sel = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = ""; empty.textContent = "（預設 · 思源宋體）";
      sel.appendChild(empty);
      for (const [key, , label] of FONT_OPTIONS) {
        const o = document.createElement("option");
        o.value = key; o.textContent = label;
        if (theme.font === key) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => this.#patch("font", sel.value));
      return field(f.label, sel);
    }

    if (f.type === "opacity") {
      const wrap = document.createElement("div");
      wrap.className = "theme-slider";
      const range = document.createElement("input");
      range.type = "range"; range.min = "0"; range.max = "1"; range.step = "0.02";
      range.value = String(theme[f.key] != null ? theme[f.key] : f.default);
      const num = document.createElement("span");
      num.className = "theme-slider-val";
      num.textContent = Number(range.value).toFixed(2);
      // 拖曳中即時更新範例，放開才寫入
      range.addEventListener("input", () => {
        num.textContent = Number(range.value).toFixed(2);
        this.#applySample({ ...this.#theme, [f.key]: Number(range.value) });
      });
      range.addEventListener("change", () => this.#patch(f.key, Number(range.value)));
      wrap.append(range, num);
      return field(f.label, wrap);
    }

    // color
    const wrap = document.createElement("div");
    wrap.className = "theme-color";
    const inp = document.createElement("input");
    inp.type = "color";
    inp.value = theme[f.key] || f.default;
    const tag = document.createElement("span");
    tag.className = "theme-color-tag";
    tag.textContent = theme[f.key] ? theme[f.key] : "預設";
    inp.addEventListener("input", () => this.#applySample({ ...this.#theme, [f.key]: inp.value }));
    inp.addEventListener("change", () => { this.#patch(f.key, inp.value); tag.textContent = inp.value; });
    wrap.append(inp, tag);
    return field(f.label, wrap);
  }

  #renderSample(theme) {
    const sample = document.createElement("div");
    sample.className = "theme-sample";

    const stage = document.createElement("div");
    stage.className = "theme-sample-stage";
    stage.innerHTML = `
      <div class="ts-speaker">項羽</div>
      <div class="ts-box">
        <p class="ts-text">力拔山兮氣蓋世，時不利兮騅不逝。<br>騅不逝兮可奈何，虞兮虞兮奈若何！</p>
        <span class="ts-indicator">▼</span>
      </div>
      <div class="ts-choices">
        <button class="ts-choice">舉杯</button>
        <button class="ts-choice">按劍不動</button>
      </div>
    `;
    sample.appendChild(stage);

    const hint = document.createElement("div");
    hint.className = "muted theme-sample-hint";
    hint.textContent = "即時預覽（實際遊戲畫面亦套用相同設定）";
    sample.appendChild(hint);

    this._sample = stage;
    applyTheme(theme, stage);
    return sample;
  }
}
