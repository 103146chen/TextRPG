// ============================================
// AudioManager.js
// BGM 與音效管理（支援跨場景持續播放）
// ============================================

export class AudioManager {
  constructor(storyPath) {
    this.storyPath = storyPath;
    this.bgm = null;
    this.currentBgmFile = null;
    this.bgmVolume = 0.5;
    this.seVolume = 0.7;
    this.muted = false;
  }

  async playBgm(fileName, { fadeIn = 1000, loop = true } = {}) {
    if (this.currentBgmFile === fileName) return; // 同首不重播
    await this.stopBgm(500);
    if (!fileName) return;

    this.bgm = new Audio(`${this.storyPath}/bgm/${fileName}`);
    this.bgm.loop = loop;
    this.bgm.volume = 0;
    this.currentBgmFile = fileName;

    try {
      await this.bgm.play();
    } catch (e) {
      // autoplay 被擋是常見情況，不當作錯誤
      console.info("BGM 等待使用者互動後播放:", fileName);
      return;
    }

    // 淡入
    const target = this.muted ? 0 : this.bgmVolume;
    await this.#fade(this.bgm, 0, target, fadeIn);
  }

  async stopBgm(fadeOut = 500) {
    if (!this.bgm) return;
    const cur = this.bgm;
    await this.#fade(cur, cur.volume, 0, fadeOut);
    cur.pause();
    cur.src = "";
    this.bgm = null;
    this.currentBgmFile = null;
  }

  playSe(fileName, { volume } = {}) {
    if (!fileName) return;
    const se = new Audio(`${this.storyPath}/se/${fileName}`);
    se.volume = (volume ?? this.seVolume) * (this.muted ? 0 : 1);
    se.play().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.bgm) this.bgm.volume = muted ? 0 : this.bgmVolume;
  }

  setBgmVolume(v) {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgm && !this.muted) this.bgm.volume = this.bgmVolume;
  }

  #fade(audio, from, to, duration) {
    return new Promise(resolve => {
      const steps = 20;
      const stepMs = duration / steps;
      let i = 0;
      const tick = () => {
        i++;
        const t = i / steps;
        audio.volume = from + (to - from) * t;
        if (i >= steps) { resolve(); return; }
        setTimeout(tick, stepMs);
      };
      tick();
    });
  }
}
