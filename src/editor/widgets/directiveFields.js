// ============================================
// directiveFields.js
// schema 驅動的指令檢查器：把「欄位定義」渲染成可編輯表單，
// 任一欄位變更即回呼完整 args（已去空值），由 main.js 寫回並即時預覽。
//
// 指令的解析／序列化不需改動——SceneParser/MarkdownWriter 已能承載任意
// args（positional 陣列 + 具名鍵）。這裡只負責 UI 與值的讀寫。
//
// 欄位型別：slider / number / select / checkbox / text
// 欄位可用 key（具名 args）或 positional（args.positional[N]）定位其值。
// ============================================

// ---- 值的讀寫（具名 vs 位置參數）----
function readVal(args, f) {
  if (f.positional != null) return args.positional?.[f.positional];
  return args[f.key];
}
function writeVal(args, f, v) {
  if (f.positional != null) {
    if (!Array.isArray(args.positional)) args.positional = [];
    args.positional[f.positional] = v;
  } else {
    args[f.key] = v;
  }
}

// 去掉空的具名鍵（"" / null / NaN），並修剪 positional 尾端空洞，
// 避免污染 Markdown（沿用 @show 檢查器「空值＝不指定」的語意）。
function stripEmpties(args) {
  for (const k of Object.keys(args)) {
    if (k === "positional") continue;
    const v = args[k];
    if (v === "" || v == null || (typeof v === "number" && Number.isNaN(v))) delete args[k];
  }
  if (Array.isArray(args.positional)) {
    while (args.positional.length && (args.positional[args.positional.length - 1] === "" ||
           args.positional[args.positional.length - 1] == null)) {
      args.positional.pop();
    }
  }
}

// ---- 欄位工廠 ----
// 每個工廠回傳整列 DOM，並在「確定變更」時呼叫 commit(value)。
// value === "" 代表清除該欄位。

function labeledField(label, controlEl, hint) {
  const w = document.createElement("div");
  w.className = "insp-field";
  const l = document.createElement("label");
  l.textContent = label;
  w.appendChild(l);
  w.appendChild(controlEl);
  if (hint) {
    const h = document.createElement("small");
    h.textContent = hint;
    w.appendChild(h);
  }
  return w;
}

function numberControl(f, value, commit) {
  const inp = document.createElement("input");
  inp.type = "number";
  if (f.step != null) inp.step = String(f.step);
  if (f.min != null) inp.min = String(f.min);
  if (f.max != null) inp.max = String(f.max);
  inp.placeholder = f.placeholder || (f.default != null ? String(f.default) : "");
  inp.value = value != null && value !== "" ? String(value) : "";
  inp.addEventListener("change", () => {
    const raw = inp.value.trim();
    commit(raw === "" ? "" : Number(raw));
  });
  if (!f.suffix) return { control: inp, sync: (v) => { inp.value = v === "" ? "" : String(v); } };

  const wrap = document.createElement("div");
  wrap.className = "insp-num-suffix";
  const suf = document.createElement("span");
  suf.className = "insp-suffix";
  suf.textContent = f.suffix;
  wrap.append(inp, suf);
  return { control: wrap, sync: (v) => { inp.value = v === "" ? "" : String(v); } };
}

function sliderControl(f, value, commit) {
  const wrap = document.createElement("div");
  wrap.className = "insp-slider";

  const range = document.createElement("input");
  range.type = "range";
  range.min = String(f.min ?? 0);
  range.max = String(f.max ?? 1);
  range.step = String(f.step ?? 0.01);
  const fallback = f.default != null ? f.default : (Number(f.min ?? 0));
  range.value = String(value != null && value !== "" ? value : fallback);

  const num = document.createElement("input");
  num.type = "number";
  num.className = "insp-slider-num";
  num.step = String(f.step ?? 0.01);
  if (f.min != null) num.min = String(f.min);
  if (f.max != null) num.max = String(f.max);
  num.placeholder = f.default != null ? String(f.default) : "";
  num.value = value != null && value !== "" ? String(value) : "";

  // 拖曳中：只同步數字顯示，不寫入（避免灌爆 undo）；放開才 commit
  range.addEventListener("input", () => { num.value = range.value; });
  range.addEventListener("change", () => commit(Number(range.value)));
  num.addEventListener("input", () => { if (num.value !== "") range.value = num.value; });
  num.addEventListener("change", () => {
    const raw = num.value.trim();
    commit(raw === "" ? "" : Number(raw));
  });

  wrap.append(range, num);
  return { control: wrap, sync: (v) => {
    num.value = v === "" ? "" : String(v);
    range.value = String(v === "" ? fallback : v);
  } };
}

function selectControl(f, value, commit) {
  const sel = document.createElement("select");
  if (f.optional) {
    const o = document.createElement("option");
    o.value = ""; o.textContent = f.emptyLabel || "（預設）";
    sel.appendChild(o);
  }
  for (const [val, txt] of f.options) {
    const o = document.createElement("option");
    o.value = val; o.textContent = txt;
    if (String(value ?? "") === String(val)) o.selected = true;
    sel.appendChild(o);
  }
  if (!f.optional && (value == null || value === "") && f.default != null) sel.value = String(f.default);
  sel.addEventListener("change", () => commit(sel.value));
  return { control: sel, sync: (v) => { sel.value = String(v ?? ""); } };
}

function checkboxControl(f, value, commit) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = value === true || value === "true";
  // 勾選＝true；取消勾選＝清除（回引擎預設 false）
  cb.addEventListener("change", () => commit(cb.checked ? true : ""));
  return { control: cb, sync: (v) => { cb.checked = v === true || v === "true"; } };
}

function textControl(f, value, commit) {
  const inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = f.placeholder || "";
  inp.value = value != null ? String(value) : "";
  inp.addEventListener("change", () => commit(inp.value.trim()));
  return { control: inp, sync: (v) => { inp.value = v == null ? "" : String(v); } };
}

function colorControl(f, value, commit) {
  const dflt = f.default || "#000000";
  const wrap = document.createElement("div");
  wrap.className = "insp-color";
  const inp = document.createElement("input");
  inp.type = "color";
  inp.value = value != null && value !== "" ? String(value) : dflt;
  // 只在使用者實際挑色時才寫入，避免一開檢查器就把預設色灌進 Markdown
  inp.addEventListener("change", () => commit(inp.value));
  wrap.appendChild(inp);
  if (value == null || value === "") {
    const tag = document.createElement("span");
    tag.className = "insp-color-default";
    tag.textContent = "預設";
    wrap.appendChild(tag);
  }
  return { control: wrap, sync: (v) => { inp.value = v == null || v === "" ? dflt : String(v); } };
}

const CONTROLS = {
  slider: sliderControl,
  number: numberControl,
  select: selectControl,
  checkbox: checkboxControl,
  color: colorControl,
  text: textControl,
};

/**
 * 渲染一個指令的可編輯檢查器。
 * @param {HTMLElement} host 容器
 * @param {object} ins 指令物件（含 args）
 * @param {object} schema { title, fields:[...], note? }
 * @param {(args:object)=>void} onCommit 任一欄位變更後，收到完整（去空值）的 args
 */
export function renderDirectiveForm(host, ins, schema, onCommit) {
  // 以目前 args 為基底的工作副本；欄位變更就地修改後回呼
  const args = JSON.parse(JSON.stringify(ins.args || {}));
  if (args.positional && !Array.isArray(args.positional)) args.positional = [];

  host.innerHTML = "";

  const head = document.createElement("div");
  head.className = "insp-head";
  head.innerHTML = `<strong>@${schema.title || ins.name}</strong>`;
  host.appendChild(head);

  const body = document.createElement("div");
  body.className = "insp-body";

  for (const f of schema.fields) {
    // 依 effect 等條件動態顯示（Phase 2 用；無 when 一律顯示）
    if (typeof f.when === "function" && !f.when(args)) continue;
    const factory = CONTROLS[f.type] || textControl;
    const { control } = factory(f, readVal(args, f), (v) => {
      writeVal(args, f, v);
      const out = JSON.parse(JSON.stringify(args));
      stripEmpties(out);
      onCommit(out);
    });
    body.appendChild(labeledField(f.label, control, f.hint));
  }

  host.appendChild(body);

  const note = document.createElement("div");
  note.className = "insp-note";
  note.textContent = schema.note || "調整後即時套用到預覽；留空的欄位會回到引擎預設。";
  host.appendChild(note);
}

// ---- 指令欄位 schema（欄位鍵嚴格對齊 GameRuntime 實際消費的參數）----
export const DIRECTIVE_SCHEMAS = {
  camera: {
    title: "camera · 鏡頭",
    fields: [
      { key: "zoom", label: "縮放", type: "slider", min: 0.5, max: 3, step: 0.05, default: 1, hint: "1 為原始大小；以畫面中心縮放" },
      { key: "x", label: "水平位移 X", type: "number", step: 5, suffix: "%", hint: "正值＝鏡頭右移" },
      { key: "y", label: "垂直位移 Y", type: "number", step: 5, suffix: "%", hint: "正值＝鏡頭下移" },
      { key: "duration", label: "時長", type: "number", min: 0, step: 50, suffix: "ms", hint: "過場時間，預設 800" },
      { key: "vignette", label: "暗角", type: "slider", min: 0, max: 1, step: 0.05, default: 0, hint: "邊緣壓暗，0 為關閉" },
    ],
  },
  "camera-reset": {
    title: "camera-reset · 鏡頭復位",
    note: "把鏡頭與暗角還原到預設。",
    fields: [
      { key: "duration", label: "時長", type: "number", min: 0, step: 50, suffix: "ms", hint: "回到原始鏡頭的時間，預設 800" },
    ],
  },

  // 帷幕（持續狀態）：mode 為位置參數，引擎優先讀 positional[0]
  curtain: {
    title: "curtain · 帷幕",
    fields: [
      { positional: 0, label: "動作", type: "select", default: "close",
        options: [["close", "合上"], ["open", "打開"]] },
      { key: "color", label: "顏色", type: "color", default: "#000000", hint: "帷幕的顏色" },
      { key: "duration", label: "時長", type: "number", min: 0, step: 50, suffix: "ms", hint: "預設 600" },
      { key: "full", label: "連文字框一起蓋", type: "checkbox", hint: "勾選則帷幕蓋過對話框" },
    ],
  },

  // 精靈動畫（瞬時）：角色/效果為位置參數；欄位依效果動態顯示
  sprite: {
    title: "sprite · 精靈動畫",
    fields: [
      { positional: 0, label: "角色", type: "text", placeholder: "角色名（需已在場上）" },
      { positional: 1, label: "效果", type: "select", default: "jump",
        options: [["jump", "跳躍"], ["shake", "抖動"], ["move", "位移"]] },
      { key: "duration", label: "時長", type: "number", min: 0, step: 50, suffix: "ms", hint: "預設 500" },
      // jump
      { key: "height", label: "跳躍高度", type: "number", min: 0, step: 5, suffix: "px", hint: "預設 20",
        when: (a) => (a.positional?.[1] || "jump") === "jump" },
      { key: "times", label: "次數", type: "number", min: 1, step: 1, hint: "預設 1",
        when: (a) => (a.positional?.[1] || "jump") === "jump" },
      // shake
      { key: "intensity", label: "強度", type: "slider", min: 1, max: 30, step: 1, default: 8,
        when: (a) => a.positional?.[1] === "shake" },
      // move
      { key: "x", label: "水平位移 X", type: "number", step: 5, suffix: "%", hint: "正值右移",
        when: (a) => a.positional?.[1] === "move" },
      { key: "y", label: "垂直位移 Y", type: "number", step: 5, suffix: "%", hint: "正值下移",
        when: (a) => a.positional?.[1] === "move" },
    ],
  },

  // 螢幕震動（瞬時）：強度優先讀 positional[0]
  shake: {
    title: "shake · 螢幕震動",
    fields: [
      { positional: 0, label: "強度", type: "slider", min: 1, max: 30, step: 1, default: 8 },
      { key: "duration", label: "時長", type: "number", min: 0, step: 50, suffix: "ms", hint: "預設 500" },
    ],
  },

  // 閃光（瞬時）：顏色引擎優先讀具名 color
  flash: {
    title: "flash · 閃光",
    fields: [
      { key: "color", label: "顏色", type: "color", default: "#ffffff" },
      { key: "duration", label: "時長", type: "number", min: 0, step: 50, suffix: "ms", hint: "預設 400" },
    ],
  },

  // 覆色（持續狀態）
  tint: {
    title: "tint · 覆色",
    fields: [
      { key: "color", label: "顏色", type: "color", default: "#000000" },
      { key: "opacity", label: "濃度", type: "slider", min: 0, max: 1, step: 0.05, default: 0.4 },
      { key: "duration", label: "時長", type: "number", min: 0, step: 50, suffix: "ms", hint: "預設 600" },
    ],
  },

  // 粒子（持續狀態）：類型為位置參數
  particles: {
    title: "particles · 粒子",
    fields: [
      { positional: 0, label: "類型", type: "select", default: "snow",
        options: [["snow", "雪"], ["rain", "雨"], ["petals", "花瓣"]] },
      { key: "density", label: "密度", type: "number", min: 0, step: 10, hint: "留空為預設密度" },
    ],
  },

  // 文字設定（持續狀態）
  textcfg: {
    title: "textcfg · 文字設定",
    fields: [
      { key: "speed", label: "打字速度", type: "number", min: 0, step: 5, hint: "每字毫秒，越小越快" },
      { key: "fade", label: "淡入", type: "number", min: 0, step: 50, suffix: "ms" },
      { key: "indicator", label: "續行指示", type: "select", optional: true, emptyLabel: "（預設 · 顯示）",
        options: [["on", "顯示"], ["off", "隱藏"]] },
    ],
  },
};
