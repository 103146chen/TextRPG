// ============================================
// GraphView.js
// 場景關係圖：節點是場景，連線是 goto/next/choice
// ============================================

export class GraphView {
  constructor(containerEl, project, onSelectScene) {
    this.containerEl = containerEl;
    this.project = project;
    this.onSelectScene = onSelectScene;
    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
    this.isPanning = false;
    this.panStart = null;
  }

  render() {
    this.containerEl.innerHTML = "";
    this.containerEl.className = "graph-view";

    const layout = this.#computeLayout();
    const svg = this.#renderSvg(layout);
    this.containerEl.appendChild(svg);

    this.#setupPanZoom(svg);
  }

  // ==================== 佈局演算 ====================

  /**
   * 簡易 BFS 分層佈局：
   * - 從 start 開始 BFS，每層放在同一個 y 座標
   * - 同層節點水平分散
   * - 無法到達的孤兒節點放在最下方
   */
  #computeLayout() {
    const startId = this.project.storyMeta?.start;
    const allIds = this.project.getAllSceneIds();
    const nodeWidth = 200;
    const nodeHeight = 72;
    const xGap = 40;
    const yGap = 110;

    const levels = new Map();  // sceneId -> 層級
    const queue = startId ? [[startId, 0]] : [];
    const visited = new Set();

    while (queue.length > 0) {
      const [id, lv] = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      // 若已有較小層級則保留較小的（拓撲往前）
      const existing = levels.get(id);
      levels.set(id, existing === undefined ? lv : Math.min(existing, lv));

      const scene = this.project.getScene(id);
      if (!scene) continue;
      const nexts = this.#getOutgoingEdges(scene);
      for (const e of nexts) {
        if (allIds.includes(e.target) && !visited.has(e.target)) {
          queue.push([e.target, lv + 1]);
        }
      }
    }

    // 無法到達的場景放在一個特別的層級（最大層級 + 1）
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

    // 計算每個節點的座標
    const positions = new Map();
    let maxWidth = 0;
    for (const [lv, ids] of byLevel) {
      const totalW = ids.length * nodeWidth + (ids.length - 1) * xGap;
      maxWidth = Math.max(maxWidth, totalW);
    }

    for (const [lv, ids] of byLevel) {
      const totalW = ids.length * nodeWidth + (ids.length - 1) * xGap;
      const startX = (maxWidth - totalW) / 2;
      ids.forEach((id, i) => {
        positions.set(id, {
          x: startX + i * (nodeWidth + xGap),
          y: lv * (nodeHeight + yGap) + 40,
          width: nodeWidth,
          height: nodeHeight,
          isOrphan: lv === orphanLv && !this.#isReachable(id),
        });
      });
    }

    // 收集所有邊
    const edges = [];
    for (const id of allIds) {
      const scene = this.project.getScene(id);
      if (!scene) continue;
      for (const edge of this.#getOutgoingEdges(scene)) {
        if (positions.has(edge.target)) {
          edges.push({ from: id, ...edge });
        }
      }
    }

    return {
      positions,
      edges,
      width: Math.max(800, maxWidth + 80),
      height: Math.max(400, (maxLv + 2) * (nodeHeight + yGap) + 80),
      startId,
    };
  }

  #getOutgoingEdges(scene) {
    const edges = [];
    const seen = new Set();
    const add = (target, type, label) => {
      const key = `${target}|${type}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ target, type, label });
    };
    if (scene.meta.next) add(scene.meta.next, "next", "");
    for (const ins of scene.instructions) {
      if (ins.type === "goto" && ins.target && this.project.getScene(ins.target)) {
        add(ins.target, "goto", "");
      }
      if (ins.type === "choice") {
        for (const opt of ins.options) {
          if (opt.goto && this.project.getScene(opt.goto)) {
            add(opt.goto, "choice", opt.text || "(選項)");
          }
        }
      }
    }
    return edges;
  }

  #isReachable(sceneId) {
    const start = this.project.storyMeta?.start;
    if (!start) return false;
    const visited = new Set();
    const queue = [start];
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === sceneId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      const sc = this.project.getScene(id);
      if (!sc) continue;
      for (const e of this.#getOutgoingEdges(sc)) queue.push(e.target);
    }
    return false;
  }

  // ==================== SVG 渲染 ====================

  #renderSvg(layout) {
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    svg.style.cursor = "grab";

    // defs：箭頭
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

    // 邊
    const edgesLayer = document.createElementNS(svgns, "g");
    for (const edge of layout.edges) {
      const from = layout.positions.get(edge.from);
      const to = layout.positions.get(edge.target);
      if (!from || !to) continue;

      const x1 = from.x + from.width / 2;
      const y1 = from.y + from.height;
      const x2 = to.x + to.width / 2;
      const y2 = to.y;

      // 貝茲曲線
      const cy = (y1 + y2) / 2;
      const path = document.createElementNS(svgns, "path");
      path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`);
      path.setAttribute("fill", "none");
      const styles = {
        next:   { color: "#6b9dc0", dash: null, marker: "arr-next" },
        goto:   { color: "#a88bd4", dash: "2 3", marker: "arr-goto" },
        choice: { color: "#d4a060", dash: "6 4", marker: "arr-choice" },
      };
      const s = styles[edge.type] || styles.next;
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", "1.5");
      if (s.dash) path.setAttribute("stroke-dasharray", s.dash);
      path.setAttribute("marker-end", `url(#${s.marker})`);
      path.setAttribute("opacity", "0.7");
      edgesLayer.appendChild(path);

      // 選項文字標示（只在中點顯示）
      if (edge.type === "choice" && edge.label) {
        const mx = (x1 + x2) / 2;
        const my = cy;
        const text = document.createElementNS(svgns, "text");
        text.setAttribute("x", mx);
        text.setAttribute("y", my);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#d4a060");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-family", "sans-serif");
        // 背景襯底讓文字可讀
        const bg = document.createElementNS(svgns, "rect");
        const approxW = Math.min(edge.label.length * 7 + 12, 180);
        bg.setAttribute("x", mx - approxW / 2);
        bg.setAttribute("y", my - 9);
        bg.setAttribute("width", approxW);
        bg.setAttribute("height", 14);
        bg.setAttribute("fill", "#1a1d23");
        bg.setAttribute("rx", "2");
        edgesLayer.appendChild(bg);
        text.textContent = edge.label.length > 20 ? edge.label.slice(0, 18) + "…" : edge.label;
        edgesLayer.appendChild(text);
      }
    }
    svg.appendChild(edgesLayer);

    // 節點
    const nodesLayer = document.createElementNS(svgns, "g");
    for (const [sceneId, pos] of layout.positions) {
      const scene = this.project.getScene(sceneId);
      if (!scene) continue;

      const g = document.createElementNS(svgns, "g");
      g.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
      g.style.cursor = "pointer";

      const isStart = sceneId === layout.startId;
      const hasEnding = scene.instructions.some(i => i.type === "ending");
      const isDirty = scene.dirty;

      // 節點主體
      const rect = document.createElementNS(svgns, "rect");
      rect.setAttribute("x", 0);
      rect.setAttribute("y", 0);
      rect.setAttribute("width", pos.width);
      rect.setAttribute("height", pos.height);
      rect.setAttribute("rx", 6);
      if (pos.isOrphan) {
        rect.setAttribute("fill", "#2a1a1a");
        rect.setAttribute("stroke", "#d46565");
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

      // 標題
      const title = document.createElementNS(svgns, "text");
      title.setAttribute("x", 12);
      title.setAttribute("y", 24);
      title.setAttribute("fill", "#e8e9ed");
      title.setAttribute("font-size", "13");
      title.setAttribute("font-weight", "500");
      title.setAttribute("font-family", "sans-serif");
      const titleText = scene.meta.title || sceneId;
      title.textContent = titleText.length > 22 ? titleText.slice(0, 20) + "…" : titleText;
      g.appendChild(title);

      // ID
      const idText = document.createElementNS(svgns, "text");
      idText.setAttribute("x", 12);
      idText.setAttribute("y", 42);
      idText.setAttribute("fill", "#6b6f7a");
      idText.setAttribute("font-size", "11");
      idText.setAttribute("font-family", "monospace");
      idText.textContent = sceneId;
      g.appendChild(idText);

      // 統計標示（選項數、指令數）
      const stats = document.createElementNS(svgns, "text");
      stats.setAttribute("x", 12);
      stats.setAttribute("y", 60);
      stats.setAttribute("fill", "#9ca0ab");
      stats.setAttribute("font-size", "10");
      stats.setAttribute("font-family", "monospace");
      const choiceCount = scene.instructions.filter(i => i.type === "choice").length;
      const insCount = scene.instructions.length;
      stats.textContent = `${insCount} 指令${choiceCount > 0 ? ` · ${choiceCount} 選項` : ""}`;
      g.appendChild(stats);

      // 徽章：起點/結局/未存檔
      if (isStart) {
        const badge = this.#renderBadge("起點", "#d4a060", "#1a1d23");
        badge.setAttribute("transform", `translate(${pos.width - 50}, 8)`);
        g.appendChild(badge);
      } else if (hasEnding) {
        const badge = this.#renderBadge("結局", "#a88bd4", "#1a1d23");
        badge.setAttribute("transform", `translate(${pos.width - 50}, 8)`);
        g.appendChild(badge);
      }
      if (isDirty) {
        const dot = document.createElementNS(svgns, "circle");
        dot.setAttribute("cx", 8);
        dot.setAttribute("cy", 8);
        dot.setAttribute("r", 3.5);
        dot.setAttribute("fill", "#d4a060");
        g.appendChild(dot);
      }

      // 點擊事件
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.onSelectScene) this.onSelectScene(sceneId);
      });

      // hover 效果
      g.addEventListener("mouseenter", () => {
        rect.setAttribute("stroke-width", "2.5");
      });
      g.addEventListener("mouseleave", () => {
        rect.setAttribute("stroke-width", "1.5");
      });

      nodesLayer.appendChild(g);
    }
    svg.appendChild(nodesLayer);

    // 圖例
    const legend = document.createElementNS(svgns, "g");
    legend.setAttribute("transform", `translate(16, ${layout.height - 80})`);
    legend.innerHTML = `
      <rect x="0" y="0" width="200" height="68" fill="#22262d" stroke="#3a3f4a" rx="4"/>
      <text x="10" y="18" fill="#e8e9ed" font-size="11" font-family="sans-serif" font-weight="500">圖例</text>
      <line x1="10" y1="32" x2="40" y2="32" stroke="#6b9dc0" stroke-width="1.5"/>
      <text x="48" y="35" fill="#9ca0ab" font-size="10" font-family="sans-serif">next (下一場景)</text>
      <line x1="10" y1="46" x2="40" y2="46" stroke="#a88bd4" stroke-width="1.5" stroke-dasharray="2 3"/>
      <text x="48" y="49" fill="#9ca0ab" font-size="10" font-family="sans-serif">@goto</text>
      <line x1="10" y1="60" x2="40" y2="60" stroke="#d4a060" stroke-width="1.5" stroke-dasharray="6 4"/>
      <text x="48" y="63" fill="#9ca0ab" font-size="10" font-family="sans-serif">選項分支</text>
    `;
    svg.appendChild(legend);

    return svg;
  }

  #renderBadge(text, bg, fg) {
    const svgns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(svgns, "g");
    const rect = document.createElementNS(svgns, "rect");
    rect.setAttribute("x", 0); rect.setAttribute("y", 0);
    rect.setAttribute("width", 38); rect.setAttribute("height", 16);
    rect.setAttribute("rx", 2); rect.setAttribute("fill", bg);
    g.appendChild(rect);
    const t = document.createElementNS(svgns, "text");
    t.setAttribute("x", 19); t.setAttribute("y", 12);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", fg);
    t.setAttribute("font-size", "10");
    t.setAttribute("font-weight", "600");
    t.setAttribute("font-family", "sans-serif");
    t.textContent = text;
    g.appendChild(t);
    return g;
  }

  // ==================== 平移/縮放 ====================

  #setupPanZoom(svg) {
    const state = { panX: 0, panY: 0, scale: 1, isPanning: false, startX: 0, startY: 0 };

    const updateTransform = () => {
      const inner = svg.querySelector("g:not(defs)");
      // 直接改 viewBox 以平移縮放
      const vb = svg.viewBox.baseVal;
      const w = vb.width / state.scale;
      const h = vb.height / state.scale;
      svg.setAttribute("viewBox", `${-state.panX} ${-state.panY} ${w} ${h}`);
    };

    svg.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "svg" || e.target.tagName === "rect" && e.target.parentNode.classList?.contains("graph-grid")) {
        state.isPanning = true;
        state.startX = e.clientX;
        state.startY = e.clientY;
        svg.style.cursor = "grabbing";
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!state.isPanning) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      state.panX += dx;
      state.panY += dy;
      state.startX = e.clientX;
      state.startY = e.clientY;
      updateTransform();
    });

    window.addEventListener("mouseup", () => {
      state.isPanning = false;
      svg.style.cursor = "grab";
    });

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const newScale = Math.max(0.3, Math.min(3, state.scale * (1 + delta)));
      state.scale = newScale;
      updateTransform();
    }, { passive: false });
  }
}
