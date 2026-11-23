import { FreecellGame } from './freecell.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
import { GameStorage, formatSavedAt } from './storage.js';
import { DeckIndex } from './deck.js';
import { nextGameNumber, randomLfsrState } from './lfsr.js';

// ─── 게임 컨트롤러 ────────────────────────────────────────────────────────

class GameController {
  /** MS FreeCell 1~32000 중 유일하게 풀 수 없는 게임 번호 */
  private static readonly UNSOLVABLE_GAMES: number[] = [11982];

  /** 랜덤 새 게임용 LFSR 상태 (null = 저장값 없음 → 첫 사용 시 랜덤 위치에서 시작) */
  private _lfsrState: number | null = null;

  /** 자동 완료 진행 중 여부 (입력/재진입 차단용) */
  private _autoCompleting = false;
  private _autoCompleteTimer = 0;

  private game:    FreecellGame;
  private renderer: Renderer;
  private input:   InputHandler;
  private sound:   SoundManager;
  private storage: GameStorage;

  private canvas!:       HTMLCanvasElement;
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
  private confirmOverlay!: HTMLElement;
  private elWinMoves!:     HTMLElement;
  private elWinTime!:      HTMLElement;
  private resumeBtn!:      HTMLButtonElement;
  private elSavedInfo!:    HTMLElement;

  // 자동저장 디바운스 타이머
  private _saveTimer:  number = 0;
  private _toastTimer: number = 0;
  private elSaveToast!: HTMLElement;

  /** 승리 애니메이션 종료 대기 타이머 (새 게임 시작 시 취소해야 함) */
  private _winOverlayTimer: number = 0;
  /** 실패 이펙트 종료 대기 폴링 타이머 (새 게임 시작 시 취소해야 함) */
  private _restartPollTimer: number = 0;

  // 확인 팝업 관련 상태
  private _confirmFromPause = false;
  private _confirmAction: 'newgame' | 'restart' = 'newgame';
  private elConfirmMsg!:    HTMLElement;
  private elConfirmYesBtn!: HTMLButtonElement;

  // 게임 번호 선택 관련
  private gameNumberOverlay!:  HTMLElement;
  private elGameNumberInput!:  HTMLInputElement;
  /** 게임 번호 다이얼로그를 열기 직전 게임 상태 */
  private _gnReturnState: 'idle' | 'play' | 'pause' | 'win' = 'idle';

  constructor() {
    this.game    = new FreecellGame();
    this.sound   = new SoundManager();
    this.storage = new GameStorage();
    this._setupDOM();
    this.renderer = new Renderer(this.canvas);
    this.input = new InputHandler(this.canvas, this.game, this.renderer, {
      onNewGame:  () => this._requestNewGame(),
      onUndo:     () => this._undo(),
      onPause:    () => this._togglePause(),
      onHelp:     () => this._toggleHelp(),
      onMoveCard: (from, to, count) => this._handleMove(from, to, count),
      onAutoMove: (from) => this._handleAutoMove(from),
      isHelpOpen: () => !this.helpOverlay.classList.contains('hidden'),
      isModalBlocking: () =>
        !this.confirmOverlay.classList.contains('hidden') ||
        !this.gameNumberOverlay.classList.contains('hidden'),
    });
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this.renderer.init();
    await this.storage.init();
    this._lfsrState = await this.storage.loadLfsrState();
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
    this.elSaveToast      = document.getElementById('save-toast')!;
    this.helpOverlay      = document.getElementById('help-overlay')!;
    this.confirmOverlay   = document.getElementById('confirm-overlay')!;
    this.elConfirmMsg     = document.getElementById('confirm-msg')!;
    this.elConfirmYesBtn  = document.getElementById('confirm-yes-btn') as HTMLButtonElement;
    this.gameNumberOverlay = document.getElementById('game-number-overlay')!;
    this.elGameNumberInput = document.getElementById('game-number-input') as HTMLInputElement;
  }

  private _bindButtons(): void {
    document.getElementById('btn-new')!.addEventListener('click', () => this._requestNewGame());
    document.getElementById('btn-restart')!.addEventListener('click', () => this._requestRestart());
    this.elUndoBtn.addEventListener('click', () => this._undo());
    this.elPauseBtn.addEventListener('click', () => this._togglePause());

    // 음소거 토글
    const muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;
    muteBtn.addEventListener('click', () => {
      this.sound.toggleMute();
      muteBtn.textContent = this.sound.muted ? '🔇' : '🔊';
      muteBtn.title       = this.sound.muted ? '소리 켜기' : '소리 끄기';
    });

    // 시작 화면
    document.getElementById('overlay-start-btn')!.addEventListener('click', async () => {
      await this.sound.init();
      this._showGameNumberDialog();
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
      this._showGameNumberDialog();
    });
    // 도움말 닫기
    document.getElementById('help-close-btn')!.addEventListener('click', () => {
      this._toggleHelp();
    });
    // 게임 번호 선택
    document.getElementById('game-number-start-btn')!.addEventListener('click', () => {
      this._onGameNumberStart();
    });
    document.getElementById('game-number-cancel-btn')!.addEventListener('click', () => {
      this._onGameNumberCancel();
    });
    this.elGameNumberInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onGameNumberStart();
      if (e.key === 'Escape') this._onGameNumberCancel();
    });
    // 새 게임 / 다시 하기 확인 팝업
    document.getElementById('confirm-yes-btn')!.addEventListener('click', () => {
      this.confirmOverlay.classList.add('hidden');
      if (this._confirmAction === 'restart') {
        this._doRestart();
      } else {
        this._showGameNumberDialog();
      }
    });
    document.getElementById('confirm-no-btn')!.addEventListener('click', () => {
      this.confirmOverlay.classList.add('hidden');
      if (this._confirmFromPause) {
        // 원래 일시정지 상태였으면 → 일시정지 화면 복원
        this.pauseOverlay.classList.remove('hidden');
      } else {
        // 원래 플레이 중이었으면 → 게임 재개
        this.game.resume();
        this._startTimer();
        this.elPauseBtn.textContent = '⏸ 일시정지';
      }
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

    this.sound.init();
    this._stopTimer();
    this._cancelWinOverlayTimer();
    this._cancelRestartPoll();
    this.renderer.stopEffects();
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
    this._updateGameNumberDisplay();

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

  /** 확인 팝업 공통 표시 헬퍼 */
  private _showConfirm(action: 'newgame' | 'restart'): void {
    this._confirmAction   = action;
    this._confirmFromPause = this.game.state === 'pause';

    if (action === 'restart') {
      this.elConfirmMsg.innerHTML     = '현재 게임을 처음부터<br>다시 시작할까요?';
      this.elConfirmYesBtn.textContent = '♻ 다시 하기';
    } else {
      this.elConfirmMsg.innerHTML     = '진행 중인 게임을 포기하고<br>새 게임을 시작할까요?';
      this.elConfirmYesBtn.textContent = '✦ 새 게임';
    }

    if (this.game.state === 'play') {
      this.game.pause();
      this._stopTimer();
      this.elPauseBtn.textContent = '▶ 계속';
    }
    this.pauseOverlay.classList.add('hidden');
    this.confirmOverlay.classList.remove('hidden');
  }

  /** 새 게임 요청: 게임 진행 중이면 확인 팝업, 아니면 게임 번호 선택으로 */
  private _requestNewGame(): void {
    if (this.game.state === 'play' || this.game.state === 'pause') {
      this._showConfirm('newgame');
    } else {
      this._showGameNumberDialog();
    }
  }

  /** 게임 번호 선택 다이얼로그 표시 */
  private _showGameNumberDialog(): void {
    this._gnReturnState = this.game.state;
    this._hideAllOverlays();
    this.elGameNumberInput.value = '';
    this._clearGameNumberError();
    this.gameNumberOverlay.classList.remove('hidden');
    // 약간의 딜레이 후 포커스 (오버레이 전환 애니메이션 후)
    setTimeout(() => this.elGameNumberInput.focus(), 50);
  }

  /** 게임 번호 다이얼로그에서 시작 */
  private _onGameNumberStart(): void {
    const raw = this.elGameNumberInput.value.trim();

    // 비워두면 랜덤 번호 — LFSR 순서로 골라 한 바퀴(1~32000) 동안 같은 판이 다시 나오지 않는다
    if (raw === '') {
      this._clearGameNumberError();
      this.gameNumberOverlay.classList.add('hidden');
      this._newGame(this._nextRandomGameNumber());
      return;
    }

    const parsed = parseInt(raw, 10);
    // 범위 밖/비정수 → 안내 후 다이얼로그 유지 (무음 fallback 제거)
    if (isNaN(parsed) || parsed < 1 || parsed > 32000) {
      this._showGameNumberError('1 – 32000 사이의 숫자를 입력하세요.');
      return;
    }
    // 풀 수 없는 게임 → 안내 후 다이얼로그 유지
    if (GameController.UNSOLVABLE_GAMES.includes(parsed)) {
      this._showGameNumberError(`#${parsed}은(는) 풀 수 없는 게임입니다. 다른 번호를 입력하세요.`);
      return;
    }

    this._clearGameNumberError();
    this.gameNumberOverlay.classList.add('hidden');
    this._newGame(parsed);
  }

  /** LFSR을 전진시켜 다음 랜덤 게임 번호를 고르고 새 상태를 저장한다 (풀 수 없는 판은 제외) */
  private _nextRandomGameNumber(): number {
    const r = nextGameNumber(
      this._lfsrState ?? randomLfsrState(),
      GameController.UNSOLVABLE_GAMES,
    );
    this._lfsrState = r.state;
    this.storage.saveLfsrState(r.state);
    return r.gameNumber;
  }

  private _showGameNumberError(msg: string): void {
    const el = document.getElementById('game-number-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
    this.elGameNumberInput.focus();
    this.elGameNumberInput.select();
  }

  private _clearGameNumberError(): void {
    const el = document.getElementById('game-number-error');
    if (el) {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  /** 게임 번호 다이얼로그에서 취소 */
  private _onGameNumberCancel(): void {
    this.gameNumberOverlay.classList.add('hidden');
    const s = this._gnReturnState;
    if (s === 'idle') {
      this.startOverlay.classList.remove('hidden');
    } else if (s === 'win') {
      this.winOverlay.classList.remove('hidden');
    } else if (s === 'pause') {
      this.pauseOverlay.classList.remove('hidden');
    } else {
      // play 상태였던 경우 (confirm → game-number-dialog 경로)
      this.game.resume();
      this._startTimer();
      this.elPauseBtn.textContent = '⏸ 일시정지';
    }
  }

  /** 다시 하기 요청 */
  private _requestRestart(): void {
    if (this.game.state === 'play' || this.game.state === 'pause') {
      this._showConfirm('restart');
    }
    // idle/win 상태에서는 다시 하기 의미 없음
  }

  /** 실패 이펙트 후 동일 배열로 재시작 */
  private _doRestart(): void {
    // 초기 배열을 모를 때는 이펙트/리셋 없이 게임 재개 (저장 데이터 보호)
    if (!this.game.canRestart) {
      this.game.resume();
      this._startTimer();
      this.elPauseBtn.textContent = '⏸ 일시정지';
      return;
    }

    this._stopTimer();
    this._cancelWinOverlayTimer();
    this.elPauseBtn.textContent = '⏸ 일시정지';
    this._hideAllOverlays();

    // 실패 이펙트 시작 (현재 카드 배치에서 불타며 날아감)
    this.sound.play('lose');
    this.renderer.startFailEffect(this.game);

    // 애니메이션 완료 후 동일 배열로 재시작
    this._restartPollTimer = window.setInterval(() => {
      if (!this.renderer.isFailAnimating) {
        this._cancelRestartPoll();
        this.game.restart();
        this.elapsed = 0;
        this._startTimer();
        this._updateUI();
        this.storage.clear();
        this._scheduleSave();
      }
    }, 100);
  }

  private _cancelRestartPoll(): void {
    if (this._restartPollTimer) {
      clearInterval(this._restartPollTimer);
      this._restartPollTimer = 0;
    }
  }

  private _newGame(gameNumber?: number): void {
    // 키보드(N)로 시작하는 경로에서도 사운드가 초기화되도록 보장 (버튼 클릭 없이 진입 가능)
    this.sound.init();
    this._stopTimer();
    this._cancelWinOverlayTimer();
    this._cancelRestartPoll();
    this.renderer.stopEffects();
    this.storage.clear();
    this.game.deal(gameNumber);
    this.elapsed = 0;
    this._startTimer();
    this._hideAllOverlays();
    this.elPauseBtn.textContent = '⏸ 일시정지';
    this._updateUI();
    this._updateGameNumberDisplay();
    this._scheduleSave();
  }

  private _updateGameNumberDisplay(): void {
    const el = document.getElementById('game-number-display');
    if (!el) return;
    const n = this.game.gameNumber;
    el.textContent = n > 0 ? `#${n}` : '';
  }

  private _undo(): void {
    // 자동 완료 중 undo는 다음 tick이 즉시 같은 수를 재실행해 무효화되므로 차단
    if (this._autoCompleting) return;
    // 승리 애니메이션 중 undo는 타이머/저장/오버레이와 상태가 어긋나므로 play 상태에서만 허용
    if (this.game.state !== 'play') return;
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
    if (this._autoCompleting) return false; // 자동 완료 중 입력 차단

    // 이동 가능 장수 초과 시 자르지 않고 실패 처리 (부분 이동으로 인한 의도 불일치 방지)
    const ok = this.game.moveCard(from, to, count);
    if (ok) {
      this.sound.play('card_place');
      this._updateUI();
      this._scheduleSave(); // 이동 후 자동저장
      if (this.game.state === 'win') this._onWin();
      else this._maybeAutoComplete();
    } else {
      this.sound.play('invalid');
    }
    return ok;
  }

  private _handleAutoMove(from: DeckIndex): void {
    if (this._autoCompleting) return; // 자동 완료 중 입력 차단

    const result = this.game.autoMoveToFoundation(from);
    if (result !== null) {
      this.sound.play('card_place');
      this._updateUI();
      this._scheduleSave();
      if (this.game.state === 'win') this._onWin();
      else this._maybeAutoComplete();
    }
  }

  // ── 자동 완료 ───────────────────────────────────────────────────────────

  /** 남은 카드를 모두 Foundation으로 올릴 수 있는 상태면 자동 완료 시작 */
  private _maybeAutoComplete(): void {
    if (this._autoCompleting) return;
    if (this.game.state !== 'play') return;
    if (!this.game.canAutoComplete()) return;
    this._startAutoComplete();
  }

  /** 한 장씩 애니메이션처럼 Foundation으로 이동시키며 게임 종료까지 진행 */
  private _startAutoComplete(): void {
    this._autoCompleting = true;
    const tick = (): void => {
      if (this.game.state !== 'play') { this._stopAutoComplete(); return; }
      let moved = false;
      for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) {
        if (this.game.autoMoveToFoundation(i as DeckIndex) !== null) { moved = true; break; }
      }
      if (!moved) { this._stopAutoComplete(); return; }

      this.sound.play('card_place');
      this._updateUI();
      if (this.game.isWin()) {
        this._stopAutoComplete();
        this._onWin();
        return;
      }
      this._autoCompleteTimer = window.setTimeout(tick, 120);
    };
    this._autoCompleteTimer = window.setTimeout(tick, 120);
  }

  private _stopAutoComplete(): void {
    this._autoCompleting = false;
    if (this._autoCompleteTimer) {
      clearTimeout(this._autoCompleteTimer);
      this._autoCompleteTimer = 0;
    }
  }

  private _onWin(): void {
    this._stopTimer();
    this.storage.clear(); // 게임 완료 → 저장 데이터 삭제
    this.sound.play('win');
    this.renderer.startWinEffect(this.game);

    this.elWinMoves.textContent = String(this.game.moveCount);
    this.elWinTime.textContent  = this._formatTime(this.elapsed);

    // 승리 애니메이션이 끝난 뒤 결과 오버레이 표시 (안전장치로 최대 12초 대기)
    const startedAt = Date.now();
    const showWhenDone = () => {
      if (!this.renderer.isAnimating || Date.now() - startedAt > 12000) {
        this._winOverlayTimer = 0;
        this.winOverlay.classList.remove('hidden');
      } else {
        this._winOverlayTimer = window.setTimeout(showWhenDone, 250);
      }
    };
    this._winOverlayTimer = window.setTimeout(showWhenDone, 1500);
  }

  /** 예약된 승리 오버레이 표시 타이머 취소 (승리 직후 새 게임 시작 시 누출 방지) */
  private _cancelWinOverlayTimer(): void {
    if (this._winOverlayTimer) {
      clearTimeout(this._winOverlayTimer);
      this._winOverlayTimer = 0;
    }
  }

  // ── UI 업데이트 ─────────────────────────────────────────────────────────

  private _updateUI(): void {
    this.elMoves.textContent = String(this.game.moveCount);
    this.elUndoBtn.disabled  = !this.game.canUndo || this.game.state === 'win';
  }

  private _hideAllOverlays(): void {
    this.startOverlay.classList.add('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.winOverlay.classList.add('hidden');
    this.helpOverlay.classList.add('hidden');
    this.confirmOverlay.classList.add('hidden');
    this.gameNumberOverlay.classList.add('hidden');
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
    this._stopTimer(); // 기존 interval 정리 (중복 호출 시 interval 누수 방지)
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
        this.renderer.render(this.game, this.input.getDragState(), this.elapsed, this.input.getKeyboardState());
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

// ─── 진입점 ────────────────────────────────────────────────────────────────

const controller = new GameController();
controller.start().catch(console.error);
