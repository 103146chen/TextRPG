// ============================================
// SceneJson.js
// AST ⇄ JSON 的第三支 serializer（另兩支：SceneParser=MD→AST、MarkdownWriter=AST→MD）。
//
// 定位：Markdown 是磁碟上的唯一真相；JSON 用於「機器易讀」的檢視、匯出與工具交換。
//
// 注意：AST 中的 endIndex / branches / openerIndex 是 SceneParser 由結構「推導」出來的
// 跳轉索引，不序列化（避免膨脹與走鏽）；從 JSON 還原時以 SceneParser.link() 重建。
// ============================================

import { SceneParser } from "../../engine/SceneParser.js";

// 推導欄位：不寫進 JSON，還原時重算
const DERIVED_KEYS = ["endIndex", "branches", "openerIndex"];
// 執行期附加欄位：也不屬於劇本內容
const RUNTIME_KEYS = ["raw"];

export class SceneJson {
  /**
   * AST → JSON 字串
   * @param {{meta: Object, instructions: Array}} sceneData
   * @param {object} [opts]
   * @param {boolean} [opts.pretty=true]
   */
  static stringify(sceneData, { pretty = true } = {}) {
    return JSON.stringify(this.toObject(sceneData), null, pretty ? 2 : 0);
  }

  /** AST → 純資料物件（已剝除推導欄位） */
  static toObject(sceneData) {
    const meta = { ...(sceneData.meta || {}) };
    for (const k of RUNTIME_KEYS) delete meta[k];

    const instructions = (sceneData.instructions || []).map((ins) => {
      const clean = {};
      for (const [k, v] of Object.entries(ins)) {
        if (DERIVED_KEYS.includes(k) || RUNTIME_KEYS.includes(k)) continue;
        clean[k] = v;
      }
      return clean;
    });

    return { meta, instructions };
  }

  /**
   * JSON（字串或物件）→ AST（已重建跳轉索引，可直接交給引擎執行）
   * @param {string|object} input
   * @returns {{meta: Object, instructions: Array}}
   */
  static parse(input) {
    const data = typeof input === "string" ? JSON.parse(input) : input;
    if (!data || typeof data !== "object") {
      throw new Error("JSON 格式錯誤：應為物件");
    }
    const meta = data.meta && typeof data.meta === "object" ? { ...data.meta } : {};
    const instructions = Array.isArray(data.instructions) ? data.instructions : [];

    // 基本檢查：每條指令都要有 type
    for (let i = 0; i < instructions.length; i++) {
      if (!instructions[i] || typeof instructions[i].type !== "string") {
        throw new Error(`JSON 格式錯誤：第 ${i} 條指令缺少 type`);
      }
    }

    SceneParser.link(instructions);   // 重建 if/elif/else/endif 的跳轉索引
    return { meta, instructions };
  }
}
