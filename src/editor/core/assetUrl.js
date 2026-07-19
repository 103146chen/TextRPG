// ============================================
// assetUrl.js
// 資產縮圖用的 objectURL 快取。
//
// 指令列會反覆重繪（每次編輯都重建 DOM），若每次都 createObjectURL 就會
// 一直外洩。這裡用 "kind/file" 當鍵共用同一個 URL，整個 session 只讀一次檔。
// 專案切換時呼叫 clearAssetUrls() 釋放。
// ============================================

const cache = new Map();   // "kind/file" -> Promise<string|null>

/**
 * 取得資產檔的 objectURL（同一個檔重複呼叫會拿到同一個 URL）。
 * @returns {Promise<string|null>} 讀不到時為 null（檔案不存在／後端不支援）
 */
export function assetUrl(project, kind, file) {
  if (!project?.fs?.readResource || !kind || !file) return Promise.resolve(null);
  const key = `${kind}/${file}`;
  if (cache.has(key)) return cache.get(key);

  const p = project.fs.readResource(kind, file)
    .then((blob) => (blob ? URL.createObjectURL(blob) : null))
    .catch(() => null);
  cache.set(key, p);
  return p;
}

/** 釋放所有已快取的 URL（切換專案時呼叫）。 */
export function clearAssetUrls() {
  for (const p of cache.values()) {
    p.then((url) => { if (url) URL.revokeObjectURL(url); }).catch(() => {});
  }
  cache.clear();
}
