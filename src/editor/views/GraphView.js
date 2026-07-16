// ============================================
// GraphView.js
// 敘事地圖：節點是場景，連線是 next / @goto / 選項分支。
//
// S5 升級：
//   - 分支節點：選項直接列在節點內，各自從自己那一列拉出連線
//   - 未引用場景：虛線紅框 + 徽章（從起點 BFS 不可達）
//   - 工具列：放大／縮小／適應畫面／1:1
//   - 圖例改為 HTML 浮層（不再跟著畫布平移縮放）
// ============================================

const NODE_W = 200;
const BASE_H = 66;      // 標題 + id + 統計列
const ROW_H = 16;       // 每列選項高度
const MAX_ROWS = 5;     // 節點內最多列出的選項數（超過折疊成一列）
const X_GAP = 40;
const Y_GAP = 110;

export class GraphView {
  constructor(containerEl, project, onSelectScene) {
    this.containerEl = containerEl;
    this.project = project;
    this.onSelectScene = onSelectScene;
    this._panZoomAbort = null;
  }

  render() {
    // 先中止舊的 pan/zoom 事件監聽，防止 window 監聽器累積
    if (this._panZoomAbort) {
      this._panZoomAbort.abort();
      this._panZoomAbort = null;
    }
    this.containerEl.innerHTML = "";
    this.containerEl.className = "graph-view";

    if (!this.project.storyMeta || this.project.getAllSceneIds().length === 0) {
      this.containerEl.innerHTML = `<div class="graph-empty">開啟專案後，這裡會顯示場景之間的分支結構</div>`;
      return;
    }

    const layout = this.#computeLayout();
    const svg = this.#renderSvg(layout);
    this.containerEl.appendChild(svg);

    const api = this.#setupPanZoom(svg, layout);
    this.containerEl.appendChild(this.#renderToolbar(api));
    this.containerEl.appendChild(this.#renderLegend());

    // 初次渲染直接適應畫面，大型劇本不用先手動縮
    api.fit();
  }

  // ==================== 資料蒐集 ====================

  /** 場景內所有選項列（含沒有 goto 的場內分支，顯示但不拉線） */
  #collectOptions(scene) {
    const rows = [];
    for (const ins of scene.instructions) {
      if (ins.type !== "choice") continue;
      for (const opt of ins.options) {
        const target = opt.goto && this.project.getScene(opt.goto) ? opt.goto : null;
        rows.push({ text: opt.text || "(選項)", target });
      }
    }
    return rows;
  }

  /** 節點高度：基礎 + 選項列（超過 MAX_ROWS 折疊成「…還有 N 個」一列） */
  #shownRows(scene) {
    const opts = this.#collectOptions(scene);
    if (opts.length <= MAX_ROWS) return { rows: opts, more: 0 };
    return { rows: opts.slice(0, MAX_ROWS), more: opts.length - MAX_ROWS };
  }

  #nodeHeight(scene) {
    const { rows, more } = this.#shownRows(scene);
    const n = rows.length + (more ? 1 : 0);
    return BASE_H + (n ? n * ROW_H + 8 : 6);
  }

  /** next / @goto 邊（選項邊另外從選項列產生） */
  #getFlowEdges(scene) {
    const edges = [];
    const seen = new Set();
    const add = (target, type) => {
      const key = `${target}|${type}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ target, type });
    };
    if (scene.meta.next && this.project.getScene(scene.meta.next)) add(scene.meta.next, "next");
    for (const ins of scene.instructions) {
      if (ins.type === "goto" && ins.target && this.project.getScene(ins.target)) {
        add(ins.target, "goto");
      }
    }
    return edges;
  }

  /** 全部出邊（含選項），供 BFS 與可達性分析 */
  #getOutgoingTargets(scene) {
    const t = this.#getFlowEdges(scene).map((e) => e.target);
    for (const o of this.#collectOptions(scene)) if (o.target) t.push(o.target);
    return t;
  }

  // ==================== 佈局演算 ====================

  /**
   * 簡易 BFS 分層佈局：從 start 逐層往下，同層水平置中分散。
   * 節點高度不再固定（選項列數不同），每層以該層最高者決定下一層的 y。
   * 從起點不可達的場景放在最下層，虛線標示「未引用」。
   */
  #computeLayout() {
    const startId = this.project.storyMeta?.start;
    const allIds = this.project.getAllSceneIds();

    const levels = new Map();
    const queue = startId && this.project.getScene(startId) ? [[startId, 0]] : [];
    const visited = new Set();

    while (queue.length > 0) {
      const [id, lv] = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const existing = levels.get(id);
      levels.set(id, existing === undefined ? lv : Math.min(existing, lv));

      const scene = this.project.getScene(id);
      if (!scene) continue;
      for (const target of this.#getOutgoingTargets(scene)) {
        if (!visited.has(target)) queue.push([target, lv + 1]);
      }
    }

    // 不可達場景 → 最下層（未引用）
    const reachable = new Set(levels.keys());
    const maxLv = Math.max(-1, ...levels.values());
    const orphanLv = maxLv + 1;
    for (const id of allIds) {
      if (!levels.has(id)) levels.set(id, orphanLv);
    }

    // 按層級分組
    const byLevel = new Map();
    for (const [id, lv] of levels) {
      if (!byLevel.has(lv)) byLevel.set(lv, []);
      byLevel.get(lv).push(id);
    }
    const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);

    // 每層 y = 前面各層「最高節點」的累計
    const heights = new Map();
    for (const id of allIds) heights.set(id, this.#nodeHeight(this.project.getScene(id)));

    let maxWidth = 0;
    for (const ids of byLevel.values()) {
      maxWidth = Math.max(maxWidth, ids.length * NODE_W + (ids.length - 1) * X_GAP);
    }

    const positions = new Map();
    let y = 40;
    for (const lv of sortedLevels) {
      const ids = byLevel.get(lv);
      const totalW = ids.length * NODE_W + (ids.length - 1) * X_GAP;
      const startX = (maxWidth - totalW) / 2;
      let levelMaxH = 0;
      ids.forEach((id, i) => {
        const h = heights.get(id);
        levelMaxH = Math.max(levelMaxH, h);
        positions.set(id, {
          x: startX + i * (NODE_W + X_GAP),
          y,
          width: NODE_W,
          height: h,
          isOrphan: !reachable.has(id),
        });
      });
      y += levelMaxH + Y_GAP;
    }

    // 邊：流程邊（節點底部出發）＋ 選項邊（各自的選項列出發）
    const edges = [];
    for (const id of allIds) {
      const scene = this.project.getScene(id);
      if (!scene) continue;
      for (const e of this.#getFlowEdges(scene)) {
        if (positions.has(e.target)) edges.push({ from: id, target: e.target, type: e.type, row: null });
      }
      const { rows } = this.#shownRows(scene);
      const all = this.#collectOptions(scene);
      all.forEach((opt, idx) => {
        if (!opt.target || !positions.has(opt.target)) return;
        // 前 MAX_ROWS 個從自己那一列出發；被折疊的從節點底部出發
        edges.push({ from: id, target: opt.target, type: "choice", row: idx < rows.length ? idx : null });
      });
    }

    return {
      positions,
      edges,
      width: Math.max(800, maxWidth + 80),
      height: Math.max(400, y - Y_GAP + 80),
      startId,
    };
  }

  // ==================== SVG 渲染 ====================

  #renderSvg(layout) {
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    svg.style.cursor = "grab";

    const defs = document.createElementNS(svgns, "defs");
    defs.innerHTML = `
      <marker id="arr-next" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M2 2 L9 5 L2 8 Z" fill="#6b9dc0"/>
      </marker>
      <marker id="arr-goto" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M2 2 L9 5 L2 8 Z" fill="#a88bd4"/>
      </marker>
      <marker id="arr-choice" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M2 2 L9 5 L2 8 Z" fill="#d4a060"/>
      </marker>
    `;
    svg.appendChild(defs);

    // 背景格線
    const grid = document.createElementNS(svgns, "g");
    grid.setAttribute("class", "graph-grid");
    for (let x = 0; x < layout.width; x += 40) {
      const ln = document.createElementNS(svgns, "line");
      ln.setAttribute("x1", x); ln.setAttribute("y1", 0);
      ln.setAttribute("x2", x); ln.setAttribute("y2", layout.height);
      ln.setAttribute("stroke", "#2c3039"); ln.setAttribute("stroke-width", "0.5");
      grid.appendChild(ln);
    }
    for (let y = 0; y < layout.height; y += 40) {
      const ln = document.createElementNS(svgns, "line");
      ln.setAttribute("x1", 0); ln.setAttribute("y1", y);
      ln.setAttribute("x2", layout.width); ln.setAttribute("y2", y);
      ln.setAttribute("stroke", "#2c3039"); ln.setAttribute("stroke-width", "0.5");
      grid.appendChild(ln);
    }
    svg.appendChild(grid);

    // 邊（記下每條 path 連到哪兩個節點，供 hover 高亮）
    const edgesLayer = document.createElementNS(svgns, "g");
    const edgesByScene = new Map();   // sceneId -> path[]
    const linkEdge = (id, path) => {
      if (!edgesByScene.has(id)) edgesByScene.set(id, []);
      edgesByScene.get(id).push(path);
    };

    const styles = {
      next:   { color: "#6b9dc0", dash: null,  marker: "arr-next" },
      goto:   { color: "#a88bd4", dash: "2 3", marker: "arr-goto" },
      choice: { color: "#d4a060", dash: "6 4", marker: "arr-choice" },
    };

    for (const edge of layout.edges) {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.target);
      if (!from || !to) continue;

      const x2 = to.x + to.width / 2;
      const y2 = to.y;
      const path = document.createElementNS(svgns, "path");

      if (edge.type === "choice" && edge.row != null) {
        // 從自己那一列選項的右緣出發
        const x1 = from.x + from.width;
        const y1 = from.y + BASE_H + edge.row * ROW_H + ROW_H / 2 + 2;
        const cy = Math.max(y1, y2 - 60);
        path.setAttribute("d", `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2} ${cy}, ${x2} ${y2}`);
      } else {
        // 節點底部中央出發
        const x1 = from.x + from.width / 2;
        const y1 = from.y + from.height;
        const cy = (y1 + y2) / 2;
        path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`);
      }

      const s = styles[edge.type] || styles.next;
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", "1.5");
      if (s.dash) path.setAttribute("stroke-dasharray", s.dash);
      path.setAttribute("marker-end", `url(#${s.marker})`);
      path.setAttribute("opacity", "0.55");
      edgesLayer.appendChild(path);
      linkEdge(edge.from, path);
      linkEdge(edge.target, path);
    }
    svg.appendChild(edgesLayer);

    // 節點
    const nodesLayer = document.createElementNS(svgns, "g");
    for (const [sceneId, pos] of layout.positions) {
      const scene = this.project.getScene(sceneId);
      if (!scene) continue;
      nodesLayer.appendChild(this.#renderNode(sceneId, scene, pos, layout, edgesByScene));
    }
    svg.appendChild(nodesLayer);

    return svg;
  }

  #renderNode(sceneId, scene, pos, layout, edgesByScene) {
    const svgns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(svgns, "g");
    g.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
    g.style.cursor = "pointer";

    const isStart = sceneId === layout.startId;
    const hasEnding = scene.instructions.some((i) => i.type === "ending");

    const rect = document.createElementNS(svgns, "rect");
    rect.setAttribute("x", 0);
    rect.setAttribute("y", 0);
    rect.setAttribute("width", pos.width);
    rect.setAttribute("height", pos.height);
    rect.setAttribute("rx", 6);
    if (pos.isOrphan) {
      // 未引用：虛線紅框，一眼看出「沒有任何路徑會走到這裡」
      rect.setAttribute("fill", "#26211f");
      rect.setAttribute("stroke", "#d46565");
      rect.setAttribute("stroke-dasharray", "5 4");
    } else if (isStart) {
      rect.setAttribute("fill", "#2a2618");
      rect.setAttribute("stroke", "#d4a060");
    } else if (hasEnding) {
      rect.setAttribute("fill", "#1f2a26");
      rect.setAttribute("stroke", "#a88bd4");
    } else {
      rect.setAttribute("fill", "#22262d");
      rect.setAttribute("stroke", "#3a3f4a");
    }
    rect.setAttribute("stroke-width", "1.5");
    g.appendChild(rect);

    const txt = (x, y, fill, size, content, { weight, family = "sans-serif" } = {}) => {
      const t = document.createElementNS(svgns, "text");
      t.setAttribute("x", x); t.setAttribute("y", y);
      t.setAttribute("fill", fill);
      t.setAttribute("font-size", size);
      t.setAttribute("font-family", family);
      if (weight) t.setAttribute("font-weight", weight);
      t.textContent = content;
      g.appendChild(t);
      return t;
    };

    const titleText = scene.meta.title || sceneId;
    txt(12, 22, "#e8e9ed", 13, titleText.length > 22 ? titleText.slice(0, 20) + "…" : titleText, { weight: "500" });
    txt(12, 39, "#6b6f7a", 11, sceneId, { family: "monospace" });

    const insCount = scene.instructions.length;
    const optCount = this.#collectOptions(scene).length;
    txt(12, 56, "#9ca0ab", 10, `${insCount} 指令${optCount > 0 ? ` · ${optCount} 選項` : ""}`, { family: "monospace" });

    // 選項列：分支一目瞭然，各列右緣就是連線起點
    const { rows, more } = this.#shownRows(scene);
    if (rows.length) {
      const sep = document.createElementNS(svgns, "line");
      sep.setAttribute("x1", 8); sep.setAttribute("y1", BASE_H - 2);
      sep.setAttribute("x2", pos.width - 8); sep.setAttribute("y2", BASE_H - 2);
      sep.setAttribute("stroke", "#3a3f4a"); sep.setAttribute("stroke-width", "1");
      g.appendChild(sep);

      rows.forEach((opt, i) => {
        const y = BASE_H + i * ROW_H + ROW_H / 2 + 6;
        const label = opt.text.length > 13 ? opt.text.slice(0, 12) + "…" : opt.text;
        // 有 goto 的亮橘＋右緣接點；場內分支灰字
        txt(14, y, opt.target ? "#d4a060" : "#7d818c", 10, `◇ ${label}`);
        if (opt.target) {
          const dot = document.createElementNS(svgns, "circle");
          dot.setAttribute("cx", pos.width);
          dot.setAttribute("cy", BASE_H + i * ROW_H + ROW_H / 2 + 2);
          dot.setAttribute("r", 2.5);
          dot.setAttribute("fill", "#d4a060");
          g.appendChild(dot);
        }
      });
      if (more) {
        txt(14, BASE_H + rows.length * ROW_H + ROW_H / 2 + 6, "#7d818c", 10, `…還有 ${more} 個選項`);
      }
    }

    // 徽章
    if (pos.isOrphan) {
      const badge = this.#renderBadge("未引用", "#d46565", "#1a1d23");
      badge.setAttribute("transform", `translate(${pos.width - 56}, 8)`);
      g.appendChild(badge);
    } else if (isStart) {
      const badge = this.#renderBadge("起點", "#d4a060", "#1a1d23");
      badge.setAttribute("transform", `translate(${pos.width - 50}, 8)`);
      g.appendChild(badge);
    } else if (hasEnding) {
      const badge = this.#renderBadge("結局", "#a88bd4", "#1a1d23");
      badge.setAttribute("transform", `translate(${pos.width - 50}, 8)`);
      g.appendChild(badge);
    }
    if (scene.dirty) {
      const dot = document.createElementNS(svgns, "circle");
      dot.setAttribute("cx", 8); dot.setAttribute("cy", 8);
      dot.setAttribute("r", 3.5);
      dot.setAttribute("fill", "#d4a060");
      g.appendChild(dot);
    }

    g.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onSelectScene) this.onSelectScene(sceneId);
    });

    // hover：自己加粗，相連的邊高亮
    const related = () => edgesByScene.get(sceneId) || [];
    g.addEventListener("mouseenter", () => {
      rect.setAttribute("stroke-width", "2.5");
      for (const p of related()) { p.setAttribute("opacity", "1"); p.setAttribute("stroke-width", "2.5"); }
    });
    g.addEventListener("mouseleave", () => {
      rect.setAttribute("stroke-width", "1.5");
      for (const p of related()) { p.setAttribute("opacity", "0.55"); p.setAttribute("stroke-width", "1.5"); }
    });

    return g;
  }

  #renderBadge(text, bg, fg) {
    const svgns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(svgns, "g");
    const w = text.length > 2 ? 44 : 38;
    const rect = document.createElementNS(svgns, "rect");
    rect.setAttribute("x", 0); rect.setAttribute("y", 0);
    rect.setAttribute("width", w); rect.setAttribute("height", 16);
    rect.setAttribute("rx", 2); rect.setAttribute("fill", bg);
    g.appendChild(rect);
    const t = document.createElementNS(svgns, "text");
    t.setAttribute("x", w / 2); t.setAttribute("y", 12);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", fg);
    t.setAttribute("font-size", "10");
    t.setAttribute("font-weight", "600");
    t.setAttribute("font-family", "sans-serif");
    t.textContent = text;
    g.appendChild(t);
    return g;
  }

  // ==================== 工具列與圖例（HTML 浮層）====================

  #renderToolbar(api) {
    const bar = document.createElement("div");
    bar.className = "graph-toolbar";
    const btn = (label, title, fn) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.title = title;
      b.addEventListener("click", fn);
      bar.appendChild(b);
      return b;
    };
    btn("＋", "放大", () => api.zoomBy(1.25));
    btn("－", "縮小", () => api.zoomBy(0.8));
    btn("⤢", "適應畫面", () => api.fit());
    btn("1:1", "原始大小", () => api.reset());
    return bar;
  }

  #renderLegend() {
    const box = document.createElement("div");
    box.className = "graph-legend";
    box.innerHTML = `
      <div class="gl-title">圖例</div>
      <div class="gl-row"><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#6b9dc0" stroke-width="1.5"/></svg>next（下一場景）</div>
      <div class="gl-row"><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#a88bd4" stroke-width="1.5" stroke-dasharray="2 3"/></svg>@goto 跳轉</div>
      <div class="gl-row"><svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#d4a060" stroke-width="1.5" stroke-dasharray="6 4"/></svg>選項分支</div>
      <div class="gl-row"><span class="gl-swatch" style="border-color:#d4a060"></span>起點</div>
      <div class="gl-row"><span class="gl-swatch" style="border-color:#a88bd4"></span>含結局</div>
      <div class="gl-row"><span class="gl-swatch" style="border-color:#d46565;border-style:dashed"></span>未引用（不可達）</div>
    `;
    return box;
  }

  // ==================== 平移/縮放 ====================

  #setupPanZoom(svg, layout) {
    // 記錄原始 viewBox 尺寸，之後縮放都以此為基準，避免公式累積誤差
    const origW = svg.viewBox.baseVal.width;
    const origH = svg.viewBox.baseVal.height;
    const state = { panX: 0, panY: 0, scale: 1, isPanning: false, startX: 0, startY: 0 };

    const updateTransform = () => {
      svg.setAttribute("viewBox",
        `${-state.panX} ${-state.panY} ${origW / state.scale} ${origH / state.scale}`);
    };

    const abort = new AbortController();
    const { signal } = abort;
    this._panZoomAbort = abort;

    svg.addEventListener("mousedown", (e) => {
      if (e.target === svg || e.target.closest?.(".graph-grid")) {
        state.isPanning = true;
        state.startX = e.clientX;
        state.startY = e.clientY;
        svg.style.cursor = "grabbing";
        e.preventDefault();
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!state.isPanning) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const svgRect = svg.getBoundingClientRect();
      state.panX += dx * ((origW / state.scale) / svgRect.width);
      state.panY += dy * ((origH / state.scale) / svgRect.height);
      state.startX = e.clientX;
      state.startY = e.clientY;
      updateTransform();
    }, { signal });

    window.addEventListener("mouseup", () => {
      if (state.isPanning) {
        state.isPanning = false;
        svg.style.cursor = "grab";
      }
    }, { signal });

    // 以「viewBox 中某比例點」為中心的縮放（滑鼠位置或畫面中央）
    const zoomAt = (newScale, ratioX, ratioY) => {
      newScale = Math.max(0.15, Math.min(4, newScale));
      const oldVbW = origW / state.scale, oldVbH = origH / state.scale;
      const newVbW = origW / newScale, newVbH = origH / newScale;
      state.panX += ratioX * (newVbW - oldVbW);
      state.panY += ratioY * (newVbH - oldVbH);
      state.scale = newScale;
      updateTransform();
    };

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0006;
      const svgRect = svg.getBoundingClientRect();
      zoomAt(state.scale * (1 + delta),
        (e.clientX - svgRect.left) / svgRect.width,
        (e.clientY - svgRect.top) / svgRect.height);
    }, { passive: false });

    // ---- 工具列 API ----
    const api = {
      zoomBy: (f) => zoomAt(state.scale * f, 0.5, 0.5),
      reset: () => { state.scale = 1; state.panX = 0; state.panY = 0; updateTransform(); },
      fit: () => {
        // 內容外接框 + 邊距，挑一個能整個放進 viewBox 的縮放
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pos of layout.positions.values()) {
          minX = Math.min(minX, pos.x);
          minY = Math.min(minY, pos.y);
          maxX = Math.max(maxX, pos.x + pos.width);
          maxY = Math.max(maxY, pos.y + pos.height);
        }
        if (!isFinite(minX)) return;
        const pad = 60;
        const bw = maxX - minX + pad * 2;
        const bh = maxY - minY + pad * 2;
        // 小圖不放大超過 1.2 倍，避免兩三個節點糊滿全螢幕
        state.scale = Math.min(origW / bw, origH / bh, 1.2);
        const vbW = origW / state.scale, vbH = origH / state.scale;
        state.panX = -(minX - pad - (vbW - bw) / 2);
        state.panY = -(minY - pad - (vbH - bh) / 2);
        updateTransform();
      },
    };
    return api;
  }
}
