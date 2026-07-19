// ============================================
// flagUsage.js
// 蒐集「變數（flag）在劇本中的使用位置」——寫入(sets) 與 讀取(reads)。
// 由 FlagInspector（全部變數一覽）與 FlagManager（選中變數的使用處）共用，
// 避免兩份實作各自漂移。
// ============================================

const RESERVED = new Set(["true", "false", "null"]);
// 變數名：字母/底線/中日韓字起頭
const NAME_RE = /([a-zA-Z_一-鿿㐀-䶿豈-﫿][\w一-鿿㐀-䶿豈-﫿]*)/g;

function formatValue(v) {
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

/** 從條件式取出被讀取的變數名（先剝掉字串字面值避免誤判） */
export function extractFlags(expr) {
  if (!expr) return [];
  const withoutStrings = String(expr)
    .replace(/"([^"\\]|\\.)*"/g, "")
    .replace(/'([^'\\]|\\.)*'/g, "");
  const flags = [];
  let m;
  NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(withoutStrings)) !== null) {
    if (!RESERVED.has(m[1])) flags.push(m[1]);
  }
  return [...new Set(flags)];
}

/**
 * 掃過所有場景，回傳 { 變數名: { sets: [...], reads: [...] } }。
 * 每筆位置為 { sceneId, index, detail }，可直接跳轉。
 */
export function collectFlagUsages(project) {
  const result = {};
  const ensure = (name) => {
    if (!result[name]) result[name] = { sets: [], reads: [] };
    return result[name];
  };

  for (const sceneId of project.getAllSceneIds()) {
    const scene = project.getScene(sceneId);
    scene.instructions.forEach((ins, index) => {
      if (ins.type === "set") {
        ensure(ins.key).sets.push({
          sceneId, index,
          detail: `${ins.key} ${ins.op} ${formatValue(ins.value)}`,
        });
      }
      if (ins.type === "if" || ins.type === "elif") {
        for (const flag of extractFlags(ins.condition)) {
          ensure(flag).reads.push({
            sceneId, index,
            detail: `${ins.type}: ${ins.condition}`,
          });
        }
      }
      if (ins.type === "choice") {
        for (const opt of ins.options || []) {
          for (const [k, v] of Object.entries(opt.set || {})) {
            ensure(k).sets.push({
              sceneId, index,
              detail: (v && typeof v === "object" && "op" in v)
                ? `選項「${opt.text}」→ ${k} ${v.op} ${formatValue(v.value)}`
                : `選項「${opt.text}」→ ${k} = ${formatValue(v)}`,
            });
          }
        }
      }
    });
  }
  return result;
}

/** 單一變數的使用處（找不到回傳空結構） */
export function usagesOf(project, name) {
  return collectFlagUsages(project)[name] || { sets: [], reads: [] };
}
