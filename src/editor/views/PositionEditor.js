// ============================================
// PositionEditor.js
// 立繪「位置與錨點」編輯器：編輯 story.json 的 positions 具名預設。
//
// 與引擎的對應（S2d）：
//   錨點 anchor = 圖片自身的原點（左上／正中／底部置中…）
//   位置 x,y    = 該錨點落在畫面的百分比座標
//   縮放 scale  = 以錨點為中心縮放
//   **沒宣告的位置槽 → 引擎沿用內建三格版面**，所以「移除」等於恢復預設。
// ============================================

// 與引擎共用同一份錨點定義（src/ui/anchors.js），確保格線示意 = 實際渲染
import { ANCHORS, ANCHOR_ORDER, DEFAULT_ANCHOR, DEFAULT_HEIGHT_PCT, anchorOf } from "../../ui/anchors.js";

const SPRITE_H_PCT = DEFAULT_HEIGHT_PCT;
const SPRITE_ASPECT = 0.42;   // 示意用：立繪寬約為高的 0.42（僅供格線預覽）

export class PositionEditor {
  constructor(containerEl, project, { onChange = null } = {}) {
    this.containerEl = containerEl;
    this.project = project;
    this.onChange = onChange;
    this.selected = null;      // 目前編輯的位置名稱
    this._unsub = project.subscribe((t) => {
      if (t === "loaded" || t === "positions-updated") this.render();
    });
    this.render();
  }

  destroy() { this._unsub?.(); this.containerEl.innerHTML = ""; }

  // 內建三格 + 已宣告 + 劇本用到的，全部列出來
  #allSlots() {
    const names = new Set(["left", "center", "right"]);
    for (const n of Object.keys(this.project.getPositions())) names.add(n);
    for (const n of this.project.collectUsedSlots?.() || []) names.add(n);
    return [...names];
  }

  #defOf(name) {
    return this.project.getPositions()[name] || null;
  }

  render() {
    this.containerEl.innerHTML = "";
    if (!this.project.storyMeta) {
      this.containerEl.innerHTML = `<div class="asset-empty">開啟專案後可在此設定位置與錨點</div>`;
      return;
    }
    const slots = this.#allSlots();
    if (!this.selected || !slots.includes(this.selected)) this.selected = slots[0] || null;

    const wrap = document.createElement("div");
    wrap.className = "pos-editor";

    wrap.appendChild(this.#renderPresetBar(slots));
    if (this.selected) {
      wrap.appendChild(this.#renderStage());
      wrap.appendChild(this.#renderControls());
    }
    this.containerEl.appendChild(wrap);
  }

  // ---------- 位置預設列 ----------
  #renderPresetBar(slots) {
    const bar = document.createElement("div");
    bar.className = "pos-presets";

    const title = document.createElement("div");
    title.className = "pos-presets-title";
    title.textContent = "位置預設";
    bar.appendChild(title);

    const list = document.createElement("div");
    list.className = "pos-chips";
    for (const name of slots) {
      const def = this.#defOf(name);
      const chip = document.createElement("button");
      chip.className = "pos-chip" + (name === this.selected ? " active" : "") + (def ? " custom" : "");
      chip.innerHTML = `<span class="pos-chip-name">${escapeHtml(name)}</span>` +
        `<span class="pos-chip-sub">${def ? `${def.x ?? 0}, ${def.y ?? 0}` : "內建版面"}</span>`;
      chip.addEventListener("click", () => { this.selected = name; this.render(); });
      list.appendChild(chip);
    }
    bar.appendChild(list);

    const add = document.createElement("button");
    add.className = "tb-btn";
    add.textContent = "＋ 新增位置";
    add.addEventListener("click", () => {
      const name = prompt("新位置名稱（劇本用 @show 角色 <名稱> 引用）", "");
      if (!name) return;
      const key = name.trim();
      if (this.#allSlots().includes(key) && this.#defOf(key)) { alert("這個位置已經設定過了"); return; }
      this.project.upsertPosition(key, { x: 50, y: 95, anchor: DEFAULT_ANCHOR });
      this.selected = key;
    });
    bar.appendChild(add);
    return bar;
  }

  // ---------- 拖曳格線 ----------
  #renderStage() {
    const def = this.#defOf(this.selected);
    const x = def?.x ?? 50;
    const y = def?.y ?? 95;
    const anchor = def?.anchor || DEFAULT_ANCHOR;
    const scale = def?.scale ?? 1;

    const box = document.createElement("div");
    box.className = "pos-stage-wrap";

    const stage = document.createElement("div");
    stage.className = "pos-stage";
    if (!def) stage.classList.add("inherited");

    // 立繪示意框：位置依錨點換算，與引擎的 translate 規則一致
    const h = SPRITE_H_PCT * scale;
    const w = h * SPRITE_ASPECT;
    const [ax, ay] = anchorFactor(anchor);
    const sprite = document.createElement("div");
    sprite.className = "pos-sprite";
    sprite.style.height = `${h}%`;
    sprite.style.width = `${w}%`;
    sprite.style.left = `${x}%`;
    sprite.style.top = `${y}%`;
    sprite.style.transform = `translate(${-ax * 100}%, ${-ay * 100}%)`;
    sprite.innerHTML = `<span>${escapeHtml(this.selected)}</span>`;
    stage.appendChild(sprite);

    // 錨點十字
    const cross = document.createElement("div");
    cross.className = "pos-cross";
    cross.style.left = `${x}%`;
    cross.style.top = `${y}%`;
    cross.innerHTML = `<span class="pos-cross-label">${x}%, ${y}%</span>`;
    stage.appendChild(cross);

    // 拖曳設定座標。
    // 重要：拖曳「過程」只更新視覺（inline style），**放開時才 commit 一次**。
    // 若每個 move 都 upsertPosition，通知會觸發 render() 重建 DOM——
    // 手上的 stage 被銷毀、拖曳當場斷掉（症狀：只能點擊跳過去）；
    // 而且每個 move 都 #pushUndo，拖一次就塞爆 undo 堆疊。
    const coordsFrom = (e) => {
      const r = stage.getBoundingClientRect();
      return [
        Math.round(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)),
        Math.round(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)),
      ];
    };
    const label = cross.querySelector(".pos-cross-label");
    const applyVisual = (nx, ny) => {
      cross.style.left = `${nx}%`;
      cross.style.top = `${ny}%`;
      if (label) label.textContent = `${nx}%, ${ny}%`;
      sprite.style.left = `${nx}%`;
      sprite.style.top = `${ny}%`;
      stage.classList.remove("inherited");   // 拖了就代表要自訂
    };

    let dragging = false;
    let last = { x, y };

    stage.addEventListener("pointerdown", (e) => {
      dragging = true;
      stage.setPointerCapture(e.pointerId);
      const [nx, ny] = coordsFrom(e);
      last = { x: nx, y: ny };
      applyVisual(nx, ny);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const [nx, ny] = coordsFrom(e);
      last = { x: nx, y: ny };
      applyVisual(nx, ny);
    });
    const commit = () => {
      if (!dragging) return;
      dragging = false;
      const cur = this.#defOf(this.selected);
      // upsertPosition 是合併語意：只送 x/y，既有的 anchor/scale 會保留；
      // 首次自訂（原本沿用內建版面）時補上預設錨點，讓宣告完整。
      this.project.upsertPosition(this.selected, {
        x: last.x, y: last.y,
        ...(cur ? {} : { anchor: DEFAULT_ANCHOR }),
      });
      this.onChange?.();
    };
    stage.addEventListener("pointerup", commit);
    stage.addEventListener("pointercancel", commit);

    box.appendChild(stage);

    const hint = document.createElement("div");
    hint.className = "pos-hint";
    hint.textContent = def
      ? "在畫面上拖曳可設定錨點座標。虛線框為立繪示意位置。"
      : "此位置目前沿用內建三格版面。拖曳或改任一欄位即可改為自訂座標。";
    box.appendChild(hint);
    return box;
  }

  // ---------- 數值控制 ----------
  #renderControls() {
    const def = this.#defOf(this.selected);
    const anchor = def?.anchor || DEFAULT_ANCHOR;
    const c = document.createElement("div");
    c.className = "pos-controls";

    // 錨點九宮格
    const aWrap = document.createElement("div");
    aWrap.className = "pos-field";
    aWrap.innerHTML = `<label>錨點</label>`;
    const grid = document.createElement("div");
    grid.className = "pos-anchor-grid";
    for (const val of ANCHOR_ORDER) {
      const b = document.createElement("button");
      b.className = "pos-anchor" + (anchor === val ? " active" : "");
      b.textContent = ANCHORS[val].label;
      b.title = val;
      b.addEventListener("click", () => {
        this.project.upsertPosition(this.selected, {
          x: def?.x ?? 50, y: def?.y ?? 95, anchor: val,
          ...(def?.scale != null ? { scale: def.scale } : {}),
        });
        this.onChange?.();
      });
      grid.appendChild(b);
    }
    aWrap.appendChild(grid);
    const aHint = document.createElement("small");
    aHint.textContent = "圖片以哪一點對齊座標；縮放也以此點為中心。";
    aWrap.appendChild(aHint);
    c.appendChild(aWrap);

    // X / Y / 縮放
    const num = (label, value, step, onCommit, placeholder) => {
      const f = document.createElement("div");
      f.className = "pos-field";
      f.innerHTML = `<label>${label}</label>`;
      const i = document.createElement("input");
      i.type = "number"; i.step = step; i.value = value ?? "";
      if (placeholder) i.placeholder = placeholder;
      i.addEventListener("change", () => onCommit(i.value));
      f.appendChild(i);
      c.appendChild(f);
      return i;
    };
    num("X（%）", def?.x ?? "", "1", (v) => {
      this.project.upsertPosition(this.selected, { x: parseFloat(v) || 0, y: def?.y ?? 95, anchor });
      this.onChange?.();
    }, "50");
    num("Y（%）", def?.y ?? "", "1", (v) => {
      this.project.upsertPosition(this.selected, { x: def?.x ?? 50, y: parseFloat(v) || 0, anchor });
      this.onChange?.();
    }, "95");
    num("縮放", def?.scale ?? "", "0.1", (v) => {
      const n = v.trim() === "" ? null : parseFloat(v);
      const patch = { x: def?.x ?? 50, y: def?.y ?? 95, anchor };
      if (n != null && !Number.isNaN(n)) patch.scale = n;
      this.project.upsertPosition(this.selected, patch);
      if (n == null) {
        const cur = { ...this.project.getPositions()[this.selected] };
        delete cur.scale;
        this.project.upsertPosition(this.selected, cur);
      }
      this.onChange?.();
    }, "1.0");

    // 移除 = 恢復內建版面
    const rm = document.createElement("button");
    rm.className = "tb-btn";
    rm.textContent = "移除自訂（恢復內建版面）";
    rm.disabled = !def;
    rm.addEventListener("click", () => {
      if (!confirm(`移除「${this.selected}」的自訂位置？\n此位置會恢復成引擎內建的三格版面。`)) return;
      this.project.removePosition(this.selected);
      this.onChange?.();
    });
    c.appendChild(rm);

    return c;
  }
}

// 錨點 → 位移比例：直接取自共用定義，不再自行推算
function anchorFactor(anchor) {
  return anchorOf(anchor).f;
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
