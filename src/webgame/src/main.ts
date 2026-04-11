import { FreecellGame } from './freecell.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
import { DeckIndex } from './deck.js';

// ─── 게임 컨트롤러 ────────────────────────────────────────────────────────

class GameController {
  private game:     FreecellGame;
  private renderer: Renderer;
  private input:    InputHandler;
  private sound:    SoundManager;

  private canvas!:  HTMLCanvasElement;
  private _rafId = 0;
  private startTime: number = 0;
  private elapsed:  number = 0;
  private timerInterval: number = 0;

  // UI 요소
  private elMoves!:   HTMLElement;
  private elTimer!:   HTMLElement;
  private elUndoBtn!: HTMLButtonElement;
  private elPauseBtn!:HTMLButtonElement;
  private startOverlay!: HTMLElement;
  private pauseOverlay!: HTMLElement;
  private winOverlay!:   HTMLElement;
  private elWinMoves!:   HTMLElement;
  private elWinTime!:    HTMLElement;

  constructor() {
    this.game   = new FreecellGame();
    this.sound  = new SoundManager();
    this._setupDOM();
    this.renderer = new Renderer(this.canvas);
    this.input = new InputHandler(this.canvas, this.game, this.renderer, {
      onNewGame:  () => this._newGame(),
      onUndo:     () => this._undo(),
      onPause:    () => this._togglePause(),
      onMoveCard: (from, to, count) => this._handleMove(from, to, count),
      onAutoMove: (from) => this._handleAutoMove(from),
    });
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this.renderer.init();
    this._bindButtons();
    this._bindResize();
    this._loop();
  }

  private _setupDOM(): void {
    this.canvas       = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.elMoves      = document.getElementById('moves-value')!;
    this.elTimer      = document.getElementById('timer-value')!;
    this.elUndoBtn    = document.getElementById('btn-undo') as HTMLButtonElement;
    this.elPauseBtn   = document.getElementById('btn-pause') as HTMLButtonElement;
    this.startOverlay = document.getElementById('start-overlay')!;
    this.pauseOverlay = document.getElementById('pause-overlay')!;
    this.winOverlay   = document.getElementById('win-overlay')!;
    this.elWinMoves   = document.getElementById('win-moves')!;
    this.elWinTime    = document.getElementById('win-time')!;
  }

  private _bindButtons(): void {
    document.getElementById('btn-new')!.addEventListener('click', () => this._newGame());
    this.elUndoBtn.addEventListener('click', () => this._undo());
    this.elPauseBtn.addEventListener('click', () => this._togglePause());

    // 오버레이 버튼
    document.getElementById('overlay-start-btn')!.addEventListener('click', async () => {
      await this.sound.init();
      this._newGame();
    });
    document.getElementById('overlay-resume-btn')!.addEventListener('click', () => {
      this._togglePause();
    });
    document.getElementById('overlay-win-new-btn')!.addEventListener('click', () => {
      this._newGame();
    });
  }

  private _bindResize(): void {
    const ro = new ResizeObserver(() => {
      this.renderer.resize();
    });
    ro.observe(this.canvas);

    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.renderer.resize(), 100);
    });
  }

  // ── 게임 흐름 ───────────────────────────────────────────────────────────

  private _newGame(): void {
    this._stopTimer();
    this.game.deal();
    this.elapsed  = 0;
    this._startTimer();
    this._hideAllOverlays();
    this._updateUI();
  }

  private _undo(): void {
    if (!this.game.canUndo) return;
    this.game.undo();
    this.sound.play('card_flip');
    this._updateUI();
  }

  private _togglePause(): void {
    if (this.game.state === 'idle' || this.game.state === 'win') return;

    if (this.game.state === 'play') {
      this.game.pause();
      this._stopTimer();
      this.pauseOverlay.classList.remove('hidden');
      this.elPauseBtn.textContent = '▶ 계속';
    } else if (this.game.state === 'pause') {
      this.game.resume();
      this._startTimer();
      this.pauseOverlay.classList.add('hidden');
      this.elPauseBtn.textContent = '⏸ 일시정지';
    }
  }

  private _handleMove(from: DeckIndex, to: DeckIndex, count: number): boolean {
    // 실제로 이동 가능한 장수 결정 (maxMovableCount 존중)
    const maxCount = this.game.maxMovableCount(
      this.game.emptyFreeCellCount(),
      this.game.emptyTableauCount(to),
    );
    const actualCount = Math.min(count, maxCount);

    const ok = this.game.moveCard(from, to, actualCount);
    if (ok) {
      this.sound.play('card_place');
      this._updateUI();

      if (this.game.state === 'win') {
        this._onWin();
      }
    } else {
      this.sound.play('invalid');
    }
    return ok;
  }

  private _handleAutoMove(from: DeckIndex): void {
    const result = this.game.autoMoveToFoundation(from);
    if (result !== null) {
      this.sound.play('card_place');
      this._updateUI();
      if (this.game.state === 'win') this._onWin();
    }
  }

  private _onWin(): void {
    this._stopTimer();
    this.sound.play('win');
    this.renderer.startWinEffect(this.game);

    // 승리 통계 표시
    this.elWinMoves.textContent = String(this.game.moveCount);
    this.elWinTime.textContent  = this._formatTime(this.elapsed);

    setTimeout(() => {
      this.winOverlay.classList.remove('hidden');
    }, 2000);
  }

  // ── UI 업데이트 ─────────────────────────────────────────────────────────

  private _updateUI(): void {
    this.elMoves.textContent = String(this.game.moveCount);
    this.elUndoBtn.disabled  = !this.game.canUndo;
  }

  private _hideAllOverlays(): void {
    this.startOverlay.classList.add('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.winOverlay.classList.add('hidden');
  }

  // ── 타이머 ─────────────────────────────────────────────────────────────

  private _startTimer(): void {
    this.startTime = Date.now() - this.elapsed * 1000;
    this.timerInterval = window.setInterval(() => {
      this.elapsed = (Date.now() - this.startTime) / 1000;
      this.elTimer.textContent = this._formatTime(this.elapsed);
    }, 1000);
  }

  private _stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = 0;
    }
  }

  private _formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── 렌더 루프 ───────────────────────────────────────────────────────────

  private _loop(): void {
    const step = () => {
      if (this.game.state !== 'idle') {
        this.renderer.render(this.game, this.input.getDragState(), this.elapsed);
      }
      this._rafId = requestAnimationFrame(step);
      void this._rafId; // 루프 ID 보존 (향후 cancelAnimationFrame 사용 가능)
    };
    this._rafId = requestAnimationFrame(step);
  }
}

// ─── 진입점 ────────────────────────────────────────────────────────────────

const controller = new GameController();
controller.start().catch(console.error);
