/**
 * SoundManager - Web Audio API 기반 사운드 효과
 *
 * 외부 인터넷 라이브러리 없이 Web Audio API만 사용.
 * 사운드 파일이 없을 경우 프로그래매틱으로 생성한 비프음 사용.
 */
export class SoundManager {
    constructor() {
        this.ctx = null;
        this.buffers = new Map();
        this._muted = false;
        this._initialized = false;
    }
    /** 첫 사용자 제스처 후 초기화 (자동재생 정책 대응) */
    async init() {
        if (this._initialized)
            return;
        try {
            this.ctx = new AudioContext();
            await this._generateSounds();
            this._initialized = true;
        }
        catch (e) {
            console.warn('Web Audio API 초기화 실패:', e);
        }
    }
    get muted() { return this._muted; }
    toggleMute() {
        this._muted = !this._muted;
    }
    play(name) {
        if (this._muted || !this.ctx || !this._initialized)
            return;
        const buffer = this.buffers.get(name);
        if (!buffer)
            return;
        try {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.4;
            source.connect(gain);
            gain.connect(this.ctx.destination);
            source.start();
        }
        catch (e) {
            // 무시
        }
    }
    // ── 프로그래매틱 사운드 생성 ─────────────────────────────────────────────
    // 외부 파일 없이 Web Audio API로 직접 음향 합성
    async _generateSounds() {
        if (!this.ctx)
            return;
        this.buffers.set('card_place', this._makeCardPlace());
        this.buffers.set('card_flip', this._makeCardFlip());
        this.buffers.set('win', this._makeWin());
        this.buffers.set('lose', this._makeLose());
        this.buffers.set('invalid', this._makeInvalid());
    }
    /** 카드 놓기: 짧고 둔탁한 소리 */
    _makeCardPlace() {
        const ctx = this.ctx;
        const sampleRate = ctx.sampleRate;
        const duration = 0.08;
        const buf = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const decay = Math.exp(-t * 40);
            // 노이즈 + 저음 펄스
            data[i] = (Math.random() * 2 - 1) * 0.3 * decay
                + Math.sin(2 * Math.PI * 200 * t) * 0.4 * decay;
        }
        return buf;
    }
    /** 카드 뒤집기: 부드러운 슬라이드 소리 */
    _makeCardFlip() {
        const ctx = this.ctx;
        const sampleRate = ctx.sampleRate;
        const duration = 0.06;
        const buf = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const decay = Math.exp(-t * 60);
            const freq = 800 + t * 2000; // 주파수 상승
            data[i] = Math.sin(2 * Math.PI * freq * t) * 0.2 * decay
                + (Math.random() * 2 - 1) * 0.1 * decay;
        }
        return buf;
    }
    /** 승리: 상승하는 팡파레 */
    _makeWin() {
        const ctx = this.ctx;
        const sampleRate = ctx.sampleRate;
        const duration = 1.2;
        const buf = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
        const data = buf.getChannelData(0);
        // 도-미-솔-도 (C4-E4-G4-C5)
        const notes = [
            { freq: 261.6, start: 0.0, end: 0.25 },
            { freq: 329.6, start: 0.2, end: 0.45 },
            { freq: 392.0, start: 0.4, end: 0.65 },
            { freq: 523.3, start: 0.6, end: 1.2 },
        ];
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            let sample = 0;
            for (const note of notes) {
                if (t >= note.start && t < note.end) {
                    const localT = t - note.start;
                    // const noteLen = note.end - note.start;
                    const env = Math.min(localT * 20, 1) * Math.exp(-localT * 3);
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
    _makeLose() {
        const ctx = this.ctx;
        const sampleRate = ctx.sampleRate;
        const duration = 0.8;
        const buf = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
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
                    const env = Math.min(localT * 15, 1) * Math.exp(-localT * 4);
                    sample += Math.sin(2 * Math.PI * note.freq * t) * env * 0.25;
                }
            }
            data[i] = sample;
        }
        return buf;
    }
    /** 이동 불가: 짧은 경고음 */
    _makeInvalid() {
        const ctx = this.ctx;
        const sampleRate = ctx.sampleRate;
        const duration = 0.1;
        const buf = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const decay = Math.exp(-t * 30);
            data[i] = Math.sin(2 * Math.PI * 120 * t) * 0.3 * decay;
        }
        return buf;
    }
}
//# sourceMappingURL=sound.js.map