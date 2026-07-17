// ============================================
// autosave.js（S7）
// 自動存檔：任何專案變更後 delay 毫秒寫回（debounce）。
//
// 獨立成模組而非塞進 main.js：可用 MemoryBackend 直接測試存檔時序。
// 自己追蹤 dirty——hasUnsavedChanges() 只看場景，
// story.json 類變更（meta/角色/旗標/章節/位置）不會標 dirty，
// 但 saveAll() 一律會把 story.json 寫回，所以這裡只要知道「有動過」。
// ============================================

export function createAutosave({ project, fs, delay = 2500, onStatus = null }) {
  let enabled = true;
  let timer = null;
  let lastAt = null;
  let dirty = false;
  let saving = false;

  const emit = (error = null) => onStatus?.({ enabled, lastAt, error });

  const run = async () => {
    if (!enabled || saving) return;
    if (!dirty && !project.hasUnsavedChanges()) return;
    if (!fs.rootHandle) return;
    saving = true;
    try {
      dirty = false;
      await project.saveAll();
      lastAt = new Date();
      emit();
    } catch (err) {
      // 寫入失敗（權限被收回等）：停用避免無限重試轟炸，讓使用者看得到
      enabled = false;
      emit(err);
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
