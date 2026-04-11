import { FreecellGame } from './freecell.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
import { GameStorage, formatSavedAt } from './storage.js';
import { DeckIndex } from './deck.js';

// ─── 게임 컨트롤러 ────────────────────────────────────────────────────────

class GameController {
  private game:    FreecellGame;
  private renderer: Renderer;
  private input:   InputHandler;
  private sound:   SoundManager;
  private storage: GameStorage;

  private canvas!:       HTMLCanvasElement;
  private _rafId = 0;
  private startTime:     number = 0;
  private elapsed:       number = 0;
  private timerInterval: number = 0;

  // UI 요소
  private elMoves!:        HTMLElement;
  private elTimer!:        HTMLElement;
  private elUndoBtn!:      HTMLButtonElement;
  private elPauseBtn!:     HTMLButtonElement;
  private startOverlay!:   HTMLElement;
  private pauseOverlay!:   HTMLElement;
  private winOverlay!:     HTMLElement;
  private helpOverlay!:    HTMLElement;
  private elWinMoves!:     HTMLElement;
  private elWinTime!:      HTMLElement;
  private resumeBtn!:      HTMLButtonElement;
  private elSavedInfo!:    HTMLElement;

  // 자동저장 디바운스 타이머
  private _saveTimer:  number = 0;
  private _toastTimer: number = 0;
  private elSaveToast!: HTMLElement;

  constructor() {
    this.game    = new FreecellGame();
    this.sound   = new SoundManager();
    this.storage = new GameStorage();
    this._setupDOM();
    this.renderer = new Renderer(this.canvas);
    this.input = new InputHandler(this.canvas, this.game, this.renderer, {
      onNewGame:  () => this._newGame(),
      onUndo:     () => this._undo(),
      onPause:    () => this._togglePause(),
      onHelp:     () => this._toggleHelp(),
      onMoveCard: (from, to, count) => this._handleMove(from, to, count),
      onAutoMove: (from) => this._handleAutoMove(from),
    });
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this.renderer.init();
    await this.storage.init();
    this._bindButtons();
    this._bindResize();
    this._bindPageHide();
    this._loop();

    // 저장된 게임이 있으면 이어하기 버튼 활성화
    await this._checkSavedGame();
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
    this.resumeBtn    = document.getElementById('overlay-continue-btn') as HTMLButtonElement;
    this.elSavedInfo  = document.getElementById('saved-info')!;
    this.elSaveToast  = document.getElementById('save-toast')!;
    this.helpOverlay  = document.getElementById('help-overlay')!;
  }

  private _bindButtons(): void {
    document.getElementById('btn-new')!.addEventListener('click', () => this._newGame());
    this.elUndoBtn.addEventListener('click', () => this._undo());
    this.elPauseBtn.addEventListener('click', () => this._togglePause());

    // 시작 화면
    document.getElementById('overlay-start-btn')!.addEventListener('click', async () => {
      await this.sound.init();
      this._newGame();
    });
    // 이어하기 버튼
    this.resumeBtn.addEventListener('click', async () => {
      await this.sound.init();
      await this._continueGame();
    });
    // 일시정지 재개
    document.getElementById('overlay-resume-btn')!.addEventListener('click', () => {
      this._togglePause();
    });
    // 승리 후 새 게임
    document.getElementById('overlay-win-new-btn')!.addEventListener('click', () => {
      this._newGame();
    });
    // 도움말 닫기
    document.getElementById('help-close-btn')!.addEventListener('click', () => {
      this._toggleHelp();
    });
  }

  private _bindResize(): void {
    const ro = new ResizeObserver(() => { this.renderer.resize(); });
    ro.observe(this.canvas);
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.renderer.resize(), 100);
    });
  }

  /** 페이지 닫힘/숨김 시 즉시 저장 (beforeunload / pagehide 대응) */
  private _bindPageHide(): void {
    const saveNow = () => {
      if (this.game.state === 'play' || this.game.state === 'pause') {
        // pagehide/visibilitychange 에서는 async 불가 → 동기-유사 방식
        const snap = this.game.serialize(this.elapsed);
        this.storage.save(snap); // Promise 반환하지만 awaiting은 안함 (허용됨)
      }
    };
    window.addEventListener('pagehide',          saveNow);
    window.addEventListener('beforeunload',       saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
  }

  // ── 저장/불러오기 ──────────────────────────────────────────────────────

  /** 시작 화면에서 저장 게임 존재 여부 확인 후 이어하기 버튼 표시 */
  private async _checkSavedGame(): Promise<void> {
    const snap = await this.storage.load();
    if (snap) {
      this.resumeBtn.classList.remove('hidden');
      this.elSavedInfo.textContent =
        `저장: ${formatSavedAt(snap.savedAt)}  ·  이동 ${snap.moveCount}회  ·  ${this._formatTime(snap.elapsed)}`;
      this.elSavedInfo.classList.remove('hidden');
    } else {
      this.resumeBtn.classList.add('hidden');
      this.elSavedInfo.classList.add('hidden');
    }
  }

  /** 저장된 게임 이어하기 */
  private async _continueGame(): Promise<void> {
    const snap = await this.storage.load();
    if (!snap) { this._newGame(); return; }

    this._stopTimer();
    const restoredElapsed = this.game.restore(snap);
    if (restoredElapsed === null) {
      // 복원 실패 → 새 게임
      await this.storage.clear();
      this._newGame();
      return;
    }

    this.elapsed = restoredElapsed;
    this._hideAllOverlays();
    this._updateUI();

    if (this.game.state === 'play') {
      this._startTimer();
    } else {
      // 저장 당시 pause 상태였으면 재개
      this.game.resume();
      this._startTimer();
    }
  }

  /**
   * 이동 후 자동저장 (디바운스 800ms)
   * 연속 이동 시 마지막 이동만 저장되도록 처리
   */
  private _scheduleSave(): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = window.setTimeout(async () => {
      if (this.game.state === 'play' || this.game.state === 'pause') {
        const snap = this.game.serialize(this.elapsed);
        await this.storage.save(snap);
        this._showSaveToast();
      }
    }, 800);
  }

  /** 자동저장 완료 토스트 표시 (1.5초 후 사라짐) */
  private _showSaveToast(): void {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this.elSaveToast.classList.add('show');
    this._toastTimer = window.setTimeout(() => {
      this.elSaveToast.classList.remove('show');
    }, 1500);
  }

  // ── 게임 흐름 ───────────────────────────────────────────────────────────

  private _newGame(): void {
    this._stopTimer();
    this.storage.clear(); // 새 게임 시작 시 저장 삭제
    this.game.deal();
    this.elapsed = 0;
    this._startTimer();
    this._hideAllOverlays();
    this._updateUI();
    this._scheduleSave(); // 새 게임 시작 상태도 저장
  }

  private _undo(): void {
    if (!this.game.canUndo) return;
    this.game.undo();
    this.sound.play('card_flip');
    this._updateUI();
    this._scheduleSave();
  }

  private _togglePause(): void {
    if (this.game.state === 'idle' || this.game.state === 'win') return;

    if (this.game.state === 'play') {
      this.game.pause();
      this._stopTimer();
      this.pauseOverlay.classList.remove('hidden');
      this.elPauseBtn.textContent = '▶ 계속';
      // 일시정지 시 즉시 저장
      const snap = this.game.serialize(this.elapsed);
      this.storage.save(snap);
    } else if (this.game.state === 'pause') {
      this.game.resume();
      this._startTimer();
      this.pauseOverlay.classList.add('hidden');
      this.elPauseBtn.textContent = '⏸ 일시정지';
    }
  }

  private _handleMove(from: DeckIndex, to: DeckIndex, count: number): boolean {
    const maxCount = this.game.maxMovableCount(
      this.game.emptyFreeCellCount(),
      this.game.emptyTableauCount(to),
    );
    const actualCount = Math.min(count, maxCount);

    const ok = this.game.moveCard(from, to, actualCount);
    if (ok) {
      this.sound.play('card_place');
      this._updateUI();
      this._scheduleSave(); // 이동 후 자동저장
      if (this.game.state === 'win') this._onWin();
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
      this._scheduleSave();
      if (this.game.state === 'win') this._onWin();
    }
  }

  private _onWin(): void {
    this._stopTimer();
    this.storage.clear(); // 게임 완료 → 저장 데이터 삭제
    this.sound.play('win');
    this.renderer.startWinEffect(this.game);

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
    this.helpOverlay.classList.add('hidden');
  }

  /** F1 또는 닫기 버튼으로 도움말 토글 */
  private _toggleHelp(): void {
    const isOpen = !this.helpOverlay.classList.contains('hidden');
    if (isOpen) {
      this.helpOverlay.classList.add('hidden');
      // 도움말을 닫을 때 게임 중이었으면 타이머 재개
      if (this.game.state === 'play' && this.timerInterval === 0) {
        this._startTimer();
      }
    } else {
      // 다른 오버레이 위에 도움말 표시 (start/pause/win 상태에서도 열 수 있음)
      this.helpOverlay.classList.remove('hidden');
      // 게임 진행 중이면 타이머 일시 정지
      if (this.game.state === 'play') {
        this._stopTimer();
      }
    }
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
      void this._rafId;
    };
    this._rafId = requestAnimationFrame(step);
  }
}

// ─── 진입점 ────────────────────────────────────────────────────────────────

const controller = new GameController();
controller.start().catch(console.error);
