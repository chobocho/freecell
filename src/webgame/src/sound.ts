/**
 * SoundManager - Web Audio API 기반 사운드 효과
 *
 * 외부 인터넷 라이브러리 없이 Web Audio API만 사용.
 * 사운드 파일이 없을 경우 프로그래매틱으로 생성한 비프음 사용.
 */

export type SoundName = 'card_place' | 'card_flip' | 'win' | 'lose' | 'invalid';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<SoundName, AudioBuffer> = new Map();
  private _muted: boolean = false;
  private _initialized: boolean = false;

  /** 진행 중인 초기화 (연달아 호출돼도 AudioContext 를 하나만 만들기 위함) */
  private _initPromise: Promise<void> | null = null;

  /** 첫 사용자 제스처 후 초기화 (자동재생 정책 대응) */
  init(): Promise<void> {
    if (this._initialized) return Promise.resolve();
    if (!this._initPromise) {
      this._initPromise = this._doInit().finally(() => { this._initPromise = null; });
    }
    return this._initPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      const ctx = new AudioContext();
      // iOS Safari 등은 사용자 제스처 안에서 만들어도 suspended 로 시작할 수 있다.
      // init 은 클릭/키 입력 처리 중에 불리므로, 제스처가 유효한 지금 재개를 요청한다.
      // (재개가 끝나기를 기다리지는 않음 — 끝나지 않는 환경에서 초기화가 멈추는 것 방지)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { /* 무시: play() 에서 다시 시도 */ });
      }
      this.ctx = ctx;
      await this._generateSounds();
      this._initialized = true;
    } catch (e) {
      this.ctx = null;
      console.warn('Web Audio API 초기화 실패:', e);
    }
  }

  get muted(): boolean { return this._muted; }

  toggleMute(): void {
    this._muted = !this._muted;
  }

  play(name: SoundName): void {
    if (this._muted || !this.ctx || !this._initialized) return;
    // 모바일 Safari 등에서 백그라운드 복귀 후 컨텍스트가 suspended면 소리가 안 남 → 재개
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { /* 무시 */ });
    }
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.4;
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();
    } catch (e) {
      // 무시
    }
  }

  // ── 프로그래매틱 사운드 생성 ─────────────────────────────────────────────
  // 외부 파일 없이 Web Audio API로 직접 음향 합성

  private async _generateSounds(): Promise<void> {
    if (!this.ctx) return;

    this.buffers.set('card_place', this._makeCardPlace());
    this.buffers.set('card_flip',  this._makeCardFlip());
    this.buffers.set('win',        this._makeWin());
    this.buffers.set('lose',       this._makeLose());
    this.buffers.set('invalid',    this._makeInvalid());
  }

  /** 카드 놓기: 짧고 둔탁한 소리 */
  private _makeCardPlace(): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const duration   = 0.08;
    const buf = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buf.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t     = i / sampleRate;
      const decay = Math.exp(-t * 40);
      // 노이즈 + 저음 펄스
      data[i] = (Math.random() * 2 - 1) * 0.3 * decay
              + Math.sin(2 * Math.PI * 200 * t) * 0.4 * decay;
    }
    return buf;
  }

  /** 카드 뒤집기: 부드러운 슬라이드 소리 */
  private _makeCardFlip(): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const duration   = 0.06;
    const buf  = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buf.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t     = i / sampleRate;
      const decay = Math.exp(-t * 60);
      const freq  = 800 + t * 2000; // 주파수 상승
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.2 * decay
              + (Math.random() * 2 - 1) * 0.1 * decay;
    }
    return buf;
  }

  /** 승리: 상승하는 팡파레 */
  private _makeWin(): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const duration   = 1.2;
    const buf  = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buf.getChannelData(0);

    // 도-미-솔-도 (C4-E4-G4-C5)
    const notes = [
      { freq: 261.6, start: 0.0,  end: 0.25 },
      { freq: 329.6, start: 0.2,  end: 0.45 },
      { freq: 392.0, start: 0.4,  end: 0.65 },
      { freq: 523.3, start: 0.6,  end: 1.2  },
    ];

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      let sample = 0;
      for (const note of notes) {
        if (t >= note.start && t < note.end) {
          const localT  = t - note.start;
          // const noteLen = note.end - note.start;
          const env     = Math.min(localT * 20, 1) * Math.exp(-localT * 3);
          sample += Math.sin(2 * Math.PI * note.freq * t) * env * 0.3;
          // 하모닉
          sample += Math.sin(2 * Math.PI * note.freq * 2 * t) * env * 0.1;
        }
      }
      data[i] = sample;
    }
    return buf;
  }

  /** 패배: 하강하는 음 */
  private _makeLose(): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const duration   = 0.8;
    const buf  = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buf.getChannelData(0);

    const notes = [
      { freq: 392.0, start: 0.0, end: 0.3 },
      { freq: 329.6, start: 0.2, end: 0.5 },
      { freq: 261.6, start: 0.4, end: 0.8 },
    ];

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      let sample = 0;
      for (const note of notes) {
        if (t >= note.start && t < note.end) {
          const localT = t - note.start;
          const env    = Math.min(localT * 15, 1) * Math.exp(-localT * 4);
          sample += Math.sin(2 * Math.PI * note.freq * t) * env * 0.25;
        }
      }
      data[i] = sample;
    }
    return buf;
  }

  /** 이동 불가: 짧은 경고음 */
  private _makeInvalid(): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const duration   = 0.1;
    const buf  = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buf.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t     = i / sampleRate;
      const decay = Math.exp(-t * 30);
      data[i] = Math.sin(2 * Math.PI * 120 * t) * 0.3 * decay;
    }
    return buf;
  }
}
