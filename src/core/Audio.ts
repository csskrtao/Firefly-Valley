/**
 * 全部音效和音乐都用 WebAudio 实时合成，不依赖音频文件。
 * 浏览器要求用户交互后才能出声，所以第一次点击/按键时调用 unlock()。
 */
export type Sfx =
  | 'swing' | 'hit' | 'crit' | 'hurt' | 'coin' | 'pickup' | 'dig' | 'water' | 'plant'
  | 'blip' | 'select' | 'forge' | 'fail' | 'levelup' | 'slam' | 'magic' | 'dash'
  | 'door' | 'kill' | 'heal' | 'rumble';

export type Track = 'title' | 'farm' | 'night' | 'mine' | 'boss';

interface TrackDef {
  bpm: number;
  lead: OscillatorType;
  melody: (number | null)[];
  bass: (number | null)[];
  leadVol: number;
  bassVol: number;
}

// 音符用 MIDI 编号，null 为休止；每格是一个八分音符
const TRACKS: Record<Track, TrackDef> = {
  title: {
    bpm: 76, lead: 'triangle', leadVol: 0.07, bassVol: 0.05,
    melody: [72, null, 76, null, 79, null, 76, 74, 72, null, null, null, 69, null, 72, null,
      74, null, 76, null, 74, null, 72, 69, 67, null, null, null, null, null, null, null],
    bass: [48, null, null, null, 55, null, null, null, 45, null, null, null, 52, null, null, null,
      50, null, null, null, 55, null, null, null, 48, null, null, null, 43, null, null, null],
  },
  farm: {
    bpm: 104, lead: 'triangle', leadVol: 0.06, bassVol: 0.05,
    melody: [72, 74, 76, null, 79, null, 76, 74, 72, null, 69, null, 72, null, null, null,
      74, 76, 79, null, 81, null, 79, 76, 74, null, 72, null, 74, null, null, null],
    bass: [48, null, 55, null, 48, null, 55, null, 45, null, 52, null, 45, null, 52, null,
      50, null, 57, null, 50, null, 57, null, 43, null, 50, null, 43, null, 50, null],
  },
  night: {
    bpm: 70, lead: 'sine', leadVol: 0.06, bassVol: 0.045,
    melody: [76, null, null, 74, 72, null, null, null, 69, null, 72, null, 71, null, null, null,
      72, null, null, 71, 69, null, null, null, 67, null, 64, null, 67, null, null, null],
    bass: [45, null, null, null, null, null, null, null, 41, null, null, null, null, null, null, null,
      43, null, null, null, null, null, null, null, 40, null, null, null, null, null, null, null],
  },
  mine: {
    bpm: 84, lead: 'sine', leadVol: 0.05, bassVol: 0.06,
    melody: [69, null, null, 72, null, null, 71, null, 69, null, null, null, 64, null, null, null,
      65, null, null, 69, null, null, 67, null, 64, null, null, null, null, null, 62, null],
    bass: [33, null, 33, null, 40, null, 33, null, 29, null, 29, null, 36, null, 29, null,
      31, null, 31, null, 38, null, 31, null, 28, null, 28, null, 35, null, 28, null],
  },
  boss: {
    bpm: 150, lead: 'square', leadVol: 0.04, bassVol: 0.06,
    melody: [69, 72, 76, 72, 69, 72, 76, 79, 77, 76, 74, 72, 74, null, 71, null,
      69, 72, 76, 72, 69, 72, 76, 81, 80, 79, 77, 76, 77, null, 76, null],
    bass: [45, 45, 57, 45, 45, 45, 57, 45, 41, 41, 53, 41, 43, 43, 55, 43,
      45, 45, 57, 45, 45, 45, 57, 45, 41, 41, 53, 41, 40, 40, 52, 40],
  },
};

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private track: Track | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  musicVolume = 0.6;
  sfxVolume = 0.8;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(ctx.destination);
    this.musicBus.connect(ctx.destination);
    this.applyVolume();
    const len = ctx.sampleRate * 0.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    if (this.track) this.startScheduler();
  }

  setVolume(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0, bus = this.sfxBus): void {
    const ctx = this.ctx;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  sfx(name: Sfx): void {
    if (!this.ctx) return;
    switch (name) {
      case 'swing': this.noise(0.09, 0.25, 2400); break;
      case 'hit': this.tone(220, 0.08, 'square', 0.12, 110); this.noise(0.06, 0.2, 1200); break;
      case 'crit': this.tone(440, 0.1, 'square', 0.12, 220); this.tone(880, 0.12, 'triangle', 0.1, 660, 0.03); break;
      case 'hurt': this.tone(300, 0.18, 'sawtooth', 0.12, 90); break;
      case 'coin': this.tone(988, 0.06, 'square', 0.07); this.tone(1319, 0.12, 'square', 0.07, undefined, 0.06); break;
      case 'pickup': this.tone(660, 0.07, 'triangle', 0.1); this.tone(990, 0.09, 'triangle', 0.1, undefined, 0.05); break;
      case 'dig': this.noise(0.12, 0.3, 600); this.tone(140, 0.08, 'square', 0.06, 90); break;
      case 'water': this.noise(0.2, 0.15, 3000); this.tone(700, 0.15, 'sine', 0.04, 400); break;
      case 'plant': this.tone(330, 0.06, 'triangle', 0.08); this.tone(440, 0.08, 'triangle', 0.08, undefined, 0.05); break;
      case 'blip': this.tone(520, 0.03, 'square', 0.04); break;
      case 'select': this.tone(660, 0.05, 'square', 0.06); this.tone(880, 0.06, 'square', 0.05, undefined, 0.04); break;
      case 'forge':
        this.tone(1200, 0.25, 'triangle', 0.1, 1100); this.noise(0.08, 0.25, 4000);
        this.tone(1200, 0.25, 'triangle', 0.08, 1100, 0.25); this.noise(0.08, 0.2, 4000, 0.25);
        break;
      case 'fail': this.tone(300, 0.2, 'square', 0.08, 150); this.tone(200, 0.3, 'square', 0.08, 90, 0.18); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, 'square', 0.07, undefined, i * 0.08)); break;
      case 'slam': this.tone(90, 0.4, 'sine', 0.35, 40); this.noise(0.35, 0.4, 400); break;
      case 'magic': this.tone(880, 0.15, 'sine', 0.08, 1760); this.tone(1320, 0.12, 'triangle', 0.05, 2000, 0.03); break;
      case 'dash': this.noise(0.15, 0.25, 5000); this.tone(400, 0.12, 'sawtooth', 0.05, 1200); break;
      case 'door': this.tone(200, 0.08, 'square', 0.06, 150); this.tone(160, 0.1, 'square', 0.06, 120, 0.08); break;
      case 'kill': this.tone(500, 0.06, 'square', 0.08, 900); this.noise(0.1, 0.15, 2000); break;
      case 'heal': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.07, undefined, i * 0.06)); break;
      case 'rumble': this.noise(0.6, 0.3, 200); this.tone(60, 0.6, 'sine', 0.2, 40); break;
    }
  }

  music(track: Track | null): void {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (track && this.ctx) this.startScheduler();
  }

  private startScheduler(): void {
    if (!this.ctx || this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const def = TRACKS[this.track];
    const stepDur = 60 / def.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.2) {
      const delay = Math.max(0, this.nextTime - ctx.currentTime);
      const i = this.step % def.melody.length;
      const m = def.melody[i];
      const bnote = def.bass[i % def.bass.length];
      if (m !== null) this.tone(midi(m), stepDur * 1.6, def.lead, def.leadVol, undefined, delay, this.musicBus);
      if (bnote !== null) this.tone(midi(bnote), stepDur * 1.8, 'triangle', def.bassVol, undefined, delay, this.musicBus);
      this.step++;
      this.nextTime += stepDur;
    }
  }
}

export const audio = new AudioEngine();
