// ============================================
// autosave.js（S7）
// 自動存檔：任何專案變更後 delay 毫秒寫回（debounce）。
//
// 獨立成模組而非塞進 main.js：可用 MemoryBackend 直接測試存檔時序。
// 自己追蹤 dirty——hasUnsavedChanges() 只看場景，
// story.json 類變更（meta/角色/變數/章節/位置）不會標 dirty，
// 但 saveAll() 一律會把 story.json 寫回，所以這裡只要知道「有動過」。
// ============================================

export function createAutosave({ project, fs, delay = 2500, onStatus = null }) {
  let enabled = true;
  let timer = null;
  let lastAt = null;
  let dirty = false;
  let saving = false;

  const emit = (error = null) => onStatus?.({ enabled, lastAt, error });

  // 這幾類是「不會自己好」的錯誤（權限被收回、資料夾不見）→ 直接停用；
  // 其餘（例如檔案被 OneDrive/防毒碰過造成的 InvalidStateError）屬暫時性，
  // 先安靜重試，連續失敗多次才停用，避免一次同步抖動就把自動存檔關掉。
  const PERMANENT = new Set(["NotAllowedError", "SecurityError", "NotFoundError"]);
  const MAX_FAILURES = 3;
  let failures = 0;

  const run = async () => {
    if (!enabled || saving) return;
    if (!dirty && !project.hasUnsavedChanges()) return;
    if (!fs.rootHandle) return;
    saving = true;
    try {
      await project.saveAll();
      dirty = false;          // 確定寫成功才清，失敗時要保留以便重試
      failures = 0;
      lastAt = new Date();
      emit();
    } catch (err) {
      dirty = true;
      failures++;
      if (PERMANENT.has(err?.name) || failures >= MAX_FAILURES) {
        enabled = false;
        emit(err);
      } else {
        schedule();           // 安靜重試（多半下一次就成功）
      }
    } finally {
      saving = false;
    }
  };

  const schedule = () => {
    if (!enabled || !fs.rootHandle) return;
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  };

  const unsub = project.subscribe((type) => {
    if (type === "loaded" || type === "saved") return;   // 非變更事件
    dirty = true;
    schedule();
  });

  return {
    get enabled() { return enabled; },
    get lastAt() { return lastAt; },
    setEnabled(on) {
      enabled = !!on;
      if (!enabled) clearTimeout(timer);
      else if (dirty || project.hasUnsavedChanges()) schedule();
      emit();
    },
    /** 立刻存（測試與 beforeunload 用） */
    flushNow: run,
    destroy() { unsub?.(); clearTimeout(timer); },
  };
}
