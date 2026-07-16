// ============================================
// AudioManager.js
// BGM 與音效管理（支援跨場景持續播放）
// ============================================

export class AudioManager {
  constructor(storyPath, resolveAsset = null) {
    this.storyPath = storyPath;
    this.resolveAsset = resolveAsset;
    this.bgm = null;
    this.currentBgmFile = null;
    this.bgmVolume = 0.5;
    this.seVolume = 0.7;
    this.voiceVolume = 1.0;
    this.voice = null;           // 語音聲道：一次一句，新語音會停掉前一句
    this.muted = false;
  }

  async playBgm(fileName, { fadeIn = 1000, loop = true } = {}) {
    if (this.currentBgmFile === fileName) return; // 同首不重播
    await this.stopBgm(500);
    if (!fileName) return;

    this.bgm = new Audio(await this.#assetUrl("bgm", fileName));
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

  async playSe(fileName, { volume } = {}) {
    if (!fileName) return;
    const se = new Audio(await this.#assetUrl("se", fileName));
    se.volume = (volume ?? this.seVolume) * (this.muted ? 0 : 1);
    se.play().catch(() => {});
  }

  async #assetUrl(kind, fileName) {
    if (this.resolveAsset) {
      const u = await this.resolveAsset(kind, fileName);
      if (u) return u;
    }
    return `${this.storyPath}/${kind}/${fileName}`;
  }

  // 播放一句語音（對話配音）。與 BGM/SE 分離：新語音自動停掉上一句。
  async playVoice(fileName) {
    this.stopVoice();
    if (!fileName) return;
    const v = new Audio(await this.#assetUrl("voice", fileName));
    v.volume = this.muted ? 0 : this.voiceVolume;
    this.voice = v;
    v.addEventListener("ended", () => { if (this.voice === v) this.voice = null; });
    v.play().catch(() => {});
  }

  stopVoice() {
    if (!this.voice) return;
    this.voice.pause();
    this.voice.src = "";
    this.voice = null;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.bgm) this.bgm.volume = muted ? 0 : this.bgmVolume;
    if (this.voice) this.voice.volume = muted ? 0 : this.voiceVolume;
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
