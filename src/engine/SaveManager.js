// ============================================
// SaveManager.js
// 管理 localStorage 中的存檔欄位
// ============================================

const SAVE_KEY_PREFIX = "galgame.save.";
const MAX_SLOTS = 9;

export class SaveManager {
  static getSlotKey(storyId, slot) {
    return `${SAVE_KEY_PREFIX}${storyId}.${slot}`;
  }

  static save(storyId, slot, data, preview = "") {
    const payload = {
      ...data,
      preview: preview.slice(0, 200),
      savedAt: Date.now(),
    };
    localStorage.setItem(this.getSlotKey(storyId, slot), JSON.stringify(payload));
  }

  static load(storyId, slot) {
    const raw = localStorage.getItem(this.getSlotKey(storyId, slot));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static delete(storyId, slot) {
    localStorage.removeItem(this.getSlotKey(storyId, slot));
  }

  static listAll(storyId) {
    const slots = [];
    for (let i = 1; i <= MAX_SLOTS; i++) {
      slots.push({ slot: i, data: this.load(storyId, i) });
    }
    return slots;
  }

  static get MAX_SLOTS() { return MAX_SLOTS; }
}
