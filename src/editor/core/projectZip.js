// ============================================
// projectZip.js
// 透過共用 fs 介面（readStoryJson/listScenes/readScene/listResources/
// readResource 與對應 write）把專案打包成 ZIP、或從 ZIP 還原。
// 因為只用共用介面，FSAccessBackend 與 MemoryBackend 都能直接用。
// ============================================

import { zipSync, unzipSync, strToU8, strFromU8 } from "../../vendor/fflate.js";

const KINDS = ["backgrounds", "characters", "bgm", "se"];

// 專案 → ZIP Blob
export async function exportProjectZip(fs) {
  const files = {};

  const meta = await fs.readStoryJson();
  files["story.json"] = strToU8(JSON.stringify(meta, null, 2));

  for (const name of await fs.listScenes()) {
    files[`scenes/${name}`] = strToU8(await fs.readScene(name));
  }

  for (const kind of KINDS) {
    for (const file of await fs.listResources(kind)) {
      const blob = await fs.readResource(kind, file);
      if (blob) files[`${kind}/${file}`] = new Uint8Array(await blob.arrayBuffer());
    }
  }

  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: "application/zip" });
}

// ZIP（ArrayBuffer / Uint8Array）→ 專案（寫入 fs）
export async function importProjectZip(fs, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const entries = unzipSync(bytes);

  for (const [path, u8] of Object.entries(entries)) {
    if (path.endsWith("/")) continue;                 // 目錄項
    if (path === "story.json") {
      fs.writeStoryJson(JSON.parse(strFromU8(u8)));
    } else if (path.startsWith("scenes/")) {
      const name = path.slice("scenes/".length);
      if (name) await fs.writeScene(name, strFromU8(u8));
    } else {
      const slash = path.indexOf("/");
      if (slash < 0) continue;
      const kind = path.slice(0, slash);
      const file = path.slice(slash + 1);
      if (KINDS.includes(kind) && file) {
        await fs.writeResource(kind, file, new Blob([u8]));
      }
    }
  }
}
