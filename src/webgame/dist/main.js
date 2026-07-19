import { FreecellGame } from './freecell.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
import { GameStorage, formatSavedAt } from './storage.js';
import { DeckIndex } from './deck.js';
// ─── 게임 컨트롤러 ────────────────────────────────────────────────────────
class GameController {
    constructor() {
        /** 자동 완료 진행 중 여부 (입력/재진입 차단용) */
        this._autoCompleting = false;
        this._autoCompleteTimer = 0;
        this.startTime = 0;
        this.elapsed = 0;
        this.timerInterval = 0;
        // 자동저장 디바운스 타이머
        this._saveTimer = 0;
        this._toastTimer = 0;
        // 확인 팝업 관련 상태
        this._confirmFromPause = false;
        this._confirmAction = 'newgame';
        /** 게임 번호 다이얼로그를 열기 직전 게임 상태 */
        this._gnReturnState = 'idle';
        this.game = new FreecellGame();
        this.sound = new SoundManager();
        this.storage = new GameStorage();
        this._setupDOM();
        this.renderer = new Renderer(this.canvas);
        this.input = new InputHandler(this.canvas, this.game, this.renderer, {
            onNewGame: () => this._requestNewGame(),
            onUndo: () => this._undo(),
            onPause: () => this._togglePause(),
            onHelp: () => this._toggleHelp(),
            onMoveCard: (from, to, count) => this._handleMove(from, to, count),
            onAutoMove: (from) => this._handleAutoMove(from),
            isHelpOpen: () => !this.helpOverlay.classList.contains('hidden'),
            isModalBlocking: () => !this.confirmOverlay.classList.contains('hidden') ||
                !this.gameNumberOverlay.classList.contains('hidden'),
        });
    }
    // ── 초기화 ─────────────────────────────────────────────────────────────
    async start() {
        await this.renderer.init();
        await this.storage.init();
        this._bindButtons();
        this._bindResize();
        this._bindPageHide();
        this._loop();
        // 저장된 게임이 있으면 이어하기 버튼 활성화
        await this._checkSavedGame();
    }
    _setupDOM() {
        this.canvas = document.getElementById('game-canvas');
        this.elMoves = document.getElementById('moves-value');
        this.elTimer = document.getElementById('timer-value');
        this.elUndoBtn = document.getElementById('btn-undo');
        this.elPauseBtn = document.getElementById('btn-pause');
        this.startOverlay = document.getElementById('start-overlay');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.winOverlay = document.getElementById('win-overlay');
        this.elWinMoves = document.getElementById('win-moves');
        this.elWinTime = document.getElementById('win-time');
        this.resumeBtn = document.getElementById('overlay-continue-btn');
        this.elSavedInfo = document.getElementById('saved-info');
        this.elSaveToast = document.getElementById('save-toast');
        this.helpOverlay = document.getElementById('help-overlay');
        this.confirmOverlay = document.getElementById('confirm-overlay');
        this.elConfirmMsg = document.getElementById('confirm-msg');
        this.elConfirmYesBtn = document.getElementById('confirm-yes-btn');
        this.gameNumberOverlay = document.getElementById('game-number-overlay');
        this.elGameNumberInput = document.getElementById('game-number-input');
    }
    _bindButtons() {
        document.getElementById('btn-new').addEventListener('click', () => this._requestNewGame());
        document.getElementById('btn-restart').addEventListener('click', () => this._requestRestart());
        this.elUndoBtn.addEventListener('click', () => this._undo());
        this.elPauseBtn.addEventListener('click', () => this._togglePause());
        // 시작 화면
        document.getElementById('overlay-start-btn').addEventListener('click', async () => {
            await this.sound.init();
            this._showGameNumberDialog();
        });
        // 이어하기 버튼
        this.resumeBtn.addEventListener('click', async () => {
            await this.sound.init();
            await this._continueGame();
        });
        // 일시정지 재개
        document.getElementById('overlay-resume-btn').addEventListener('click', () => {
            this._togglePause();
        });
        // 승리 후 새 게임
        document.getElementById('overlay-win-new-btn').addEventListener('click', () => {
            this._showGameNumberDialog();
        });
        // 도움말 닫기
        document.getElementById('help-close-btn').addEventListener('click', () => {
            this._toggleHelp();
        });
        // 게임 번호 선택
        document.getElementById('game-number-start-btn').addEventListener('click', () => {
            this._onGameNumberStart();
        });
        document.getElementById('game-number-cancel-btn').addEventListener('click', () => {
            this._onGameNumberCancel();
        });
        this.elGameNumberInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')
                this._onGameNumberStart();
            if (e.key === 'Escape')
                this._onGameNumberCancel();
        });
        // 새 게임 / 다시 하기 확인 팝업
        document.getElementById('confirm-yes-btn').addEventListener('click', () => {
            this.confirmOverlay.classList.add('hidden');
            if (this._confirmAction === 'restart') {
                this._doRestart();
            }
            else {
                this._showGameNumberDialog();
            }
        });
        document.getElementById('confirm-no-btn').addEventListener('click', () => {
            this.confirmOverlay.classList.add('hidden');
            if (this._confirmFromPause) {
                // 원래 일시정지 상태였으면 → 일시정지 화면 복원
                this.pauseOverlay.classList.remove('hidden');
            }
            else {
                // 원래 플레이 중이었으면 → 게임 재개
                this.game.resume();
                this._startTimer();
                this.elPauseBtn.textContent = '⏸ 일시정지';
            }
        });
    }
    _bindResize() {
        const ro = new ResizeObserver(() => { this.renderer.resize(); });
        ro.observe(this.canvas);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.renderer.resize(), 100);
        });
    }
    /** 페이지 닫힘/숨김 시 즉시 저장 (beforeunload / pagehide 대응) */
    _bindPageHide() {
        const saveNow = () => {
            if (this.game.state === 'play' || this.game.state === 'pause') {
                // pagehide/visibilitychange 에서는 async 불가 → 동기-유사 방식
                const snap = this.game.serialize(this.elapsed);
                this.storage.save(snap); // Promise 반환하지만 awaiting은 안함 (허용됨)
            }
        };
        window.addEventListener('pagehide', saveNow);
        window.addEventListener('beforeunload', saveNow);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden')
                saveNow();
        });
    }
    // ── 저장/불러오기 ──────────────────────────────────────────────────────
    /** 시작 화면에서 저장 게임 존재 여부 확인 후 이어하기 버튼 표시 */
    async _checkSavedGame() {
        const snap = await this.storage.load();
        if (snap) {
            this.resumeBtn.classList.remove('hidden');
            this.elSavedInfo.textContent =
                `저장: ${formatSavedAt(snap.savedAt)}  ·  이동 ${snap.moveCount}회  ·  ${this._formatTime(snap.elapsed)}`;
            this.elSavedInfo.classList.remove('hidden');
        }
        else {
            this.resumeBtn.classList.add('hidden');
            this.elSavedInfo.classList.add('hidden');
        }
    }
    /** 저장된 게임 이어하기 */
    async _continueGame() {
        const snap = await this.storage.load();
        if (!snap) {
            this._newGame();
            return;
        }
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
        this._updateGameNumberDisplay();
        if (this.game.state === 'play') {
            this._startTimer();
        }
        else {
            // 저장 당시 pause 상태였으면 재개
            this.game.resume();
            this._startTimer();
        }
    }
    /**
     * 이동 후 자동저장 (디바운스 800ms)
     * 연속 이동 시 마지막 이동만 저장되도록 처리
     */
    _scheduleSave() {
        if (this._saveTimer)
            clearTimeout(this._saveTimer);
        this._saveTimer = window.setTimeout(async () => {
            if (this.game.state === 'play' || this.game.state === 'pause') {
                const snap = this.game.serialize(this.elapsed);
                await this.storage.save(snap);
                this._showSaveToast();
            }
        }, 800);
    }
    /** 자동저장 완료 토스트 표시 (1.5초 후 사라짐) */
    _showSaveToast() {
        if (this._toastTimer)
            clearTimeout(this._toastTimer);
        this.elSaveToast.classList.add('show');
        this._toastTimer = window.setTimeout(() => {
            this.elSaveToast.classList.remove('show');
        }, 1500);
    }
    // ── 게임 흐름 ───────────────────────────────────────────────────────────
    /** 확인 팝업 공통 표시 헬퍼 */
    _showConfirm(action) {
        this._confirmAction = action;
        this._confirmFromPause = this.game.state === 'pause';
        if (action === 'restart') {
            this.elConfirmMsg.innerHTML = '현재 게임을 처음부터<br>다시 시작할까요?';
            this.elConfirmYesBtn.textContent = '♻ 다시 하기';
        }
        else {
            this.elConfirmMsg.innerHTML = '진행 중인 게임을 포기하고<br>새 게임을 시작할까요?';
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
    _requestNewGame() {
        if (this.game.state === 'play' || this.game.state === 'pause') {
            this._showConfirm('newgame');
        }
        else {
            this._showGameNumberDialog();
        }
    }
    /** 게임 번호 선택 다이얼로그 표시 */
    _showGameNumberDialog() {
        this._gnReturnState = this.game.state;
        this._hideAllOverlays();
        this.elGameNumberInput.value = '';
        this._clearGameNumberError();
        this.gameNumberOverlay.classList.remove('hidden');
        // 약간의 딜레이 후 포커스 (오버레이 전환 애니메이션 후)
        setTimeout(() => this.elGameNumberInput.focus(), 50);
    }
    /** 게임 번호 다이얼로그에서 시작 */
    _onGameNumberStart() {
        const raw = this.elGameNumberInput.value.trim();
        // 비워두면 랜덤 게임
        if (raw === '') {
            this._clearGameNumberError();
            this.gameNumberOverlay.classList.add('hidden');
            this._newGame(undefined);
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
    _showGameNumberError(msg) {
        const el = document.getElementById('game-number-error');
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
        this.elGameNumberInput.focus();
        this.elGameNumberInput.select();
    }
    _clearGameNumberError() {
        const el = document.getElementById('game-number-error');
        if (el) {
            el.textContent = '';
            el.classList.add('hidden');
        }
    }
    /** 게임 번호 다이얼로그에서 취소 */
    _onGameNumberCancel() {
        this.gameNumberOverlay.classList.add('hidden');
        const s = this._gnReturnState;
        if (s === 'idle') {
            this.startOverlay.classList.remove('hidden');
        }
        else if (s === 'win') {
            this.winOverlay.classList.remove('hidden');
        }
        else if (s === 'pause') {
            this.pauseOverlay.classList.remove('hidden');
        }
        else {
            // play 상태였던 경우 (confirm → game-number-dialog 경로)
            this.game.resume();
            this._startTimer();
            this.elPauseBtn.textContent = '⏸ 일시정지';
        }
    }
    /** 다시 하기 요청 */
    _requestRestart() {
        if (this.game.state === 'play' || this.game.state === 'pause') {
            this._showConfirm('restart');
        }
        // idle/win 상태에서는 다시 하기 의미 없음
    }
    /** 실패 이펙트 후 동일 배열로 재시작 */
    _doRestart() {
        this._stopTimer();
        this.elPauseBtn.textContent = '⏸ 일시정지';
        this._hideAllOverlays();
        // 실패 이펙트 시작 (현재 카드 배치에서 불타며 날아감)
        this.renderer.startFailEffect(this.game);
        // 애니메이션 완료 후 동일 배열로 재시작
        const poll = window.setInterval(() => {
            if (!this.renderer.isFailAnimating) {
                clearInterval(poll);
                this.game.restart();
                this.elapsed = 0;
                this._startTimer();
                this._updateUI();
                this.storage.clear();
                this._scheduleSave();
            }
        }, 100);
    }
    _newGame(gameNumber) {
        this._stopTimer();
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
    _updateGameNumberDisplay() {
        const el = document.getElementById('game-number-display');
        if (!el)
            return;
        const n = this.game.gameNumber;
        el.textContent = n > 0 ? `#${n}` : '';
    }
    _undo() {
        if (!this.game.canUndo)
            return;
        this.game.undo();
        this.sound.play('card_flip');
        this._updateUI();
        this._scheduleSave();
    }
    _togglePause() {
        if (this.game.state === 'idle' || this.game.state === 'win')
            return;
        if (this.game.state === 'play') {
            this.game.pause();
            this._stopTimer();
            this.pauseOverlay.classList.remove('hidden');
            this.elPauseBtn.textContent = '▶ 계속';
            // 일시정지 시 즉시 저장
            const snap = this.game.serialize(this.elapsed);
            this.storage.save(snap);
        }
        else if (this.game.state === 'pause') {
            this.game.resume();
            this._startTimer();
            this.pauseOverlay.classList.add('hidden');
            this.elPauseBtn.textContent = '⏸ 일시정지';
        }
    }
    _handleMove(from, to, count) {
        if (this._autoCompleting)
            return false; // 자동 완료 중 입력 차단
        // 이동 가능 장수 초과 시 자르지 않고 실패 처리 (부분 이동으로 인한 의도 불일치 방지)
        const ok = this.game.moveCard(from, to, count);
        if (ok) {
            this.sound.play('card_place');
            this._updateUI();
            this._scheduleSave(); // 이동 후 자동저장
            if (this.game.state === 'win')
                this._onWin();
            else
                this._maybeAutoComplete();
        }
        else {
            this.sound.play('invalid');
        }
        return ok;
    }
    _handleAutoMove(from) {
        if (this._autoCompleting)
            return; // 자동 완료 중 입력 차단
        const result = this.game.autoMoveToFoundation(from);
        if (result !== null) {
            this.sound.play('card_place');
            this._updateUI();
            this._scheduleSave();
            if (this.game.state === 'win')
                this._onWin();
            else
                this._maybeAutoComplete();
        }
    }
    // ── 자동 완료 ───────────────────────────────────────────────────────────
    /** 남은 카드를 모두 Foundation으로 올릴 수 있는 상태면 자동 완료 시작 */
    _maybeAutoComplete() {
        if (this._autoCompleting)
            return;
        if (this.game.state !== 'play')
            return;
        if (!this.game.canAutoComplete())
            return;
        this._startAutoComplete();
    }
    /** 한 장씩 애니메이션처럼 Foundation으로 이동시키며 게임 종료까지 진행 */
    _startAutoComplete() {
        this._autoCompleting = true;
        const tick = () => {
            if (this.game.state !== 'play') {
                this._stopAutoComplete();
                return;
            }
            let moved = false;
            for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) {
                if (this.game.autoMoveToFoundation(i) !== null) {
                    moved = true;
                    break;
                }
            }
            if (!moved) {
                this._stopAutoComplete();
                return;
            }
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
    _stopAutoComplete() {
        this._autoCompleting = false;
        if (this._autoCompleteTimer) {
            clearTimeout(this._autoCompleteTimer);
            this._autoCompleteTimer = 0;
        }
    }
    _onWin() {
        this._stopTimer();
        this.storage.clear(); // 게임 완료 → 저장 데이터 삭제
        this.sound.play('win');
        this.renderer.startWinEffect(this.game);
        this.elWinMoves.textContent = String(this.game.moveCount);
        this.elWinTime.textContent = this._formatTime(this.elapsed);
        // 승리 애니메이션이 끝난 뒤 결과 오버레이 표시 (안전장치로 최대 12초 대기)
        const startedAt = Date.now();
        const showWhenDone = () => {
            if (!this.renderer.isAnimating || Date.now() - startedAt > 12000) {
                this.winOverlay.classList.remove('hidden');
            }
            else {
                setTimeout(showWhenDone, 250);
            }
        };
        setTimeout(showWhenDone, 1500);
    }
    // ── UI 업데이트 ─────────────────────────────────────────────────────────
    _updateUI() {
        this.elMoves.textContent = String(this.game.moveCount);
        this.elUndoBtn.disabled = !this.game.canUndo;
    }
    _hideAllOverlays() {
        this.startOverlay.classList.add('hidden');
        this.pauseOverlay.classList.add('hidden');
        this.winOverlay.classList.add('hidden');
        this.helpOverlay.classList.add('hidden');
        this.confirmOverlay.classList.add('hidden');
        this.gameNumberOverlay.classList.add('hidden');
    }
    /** F1 또는 닫기 버튼으로 도움말 토글 */
    _toggleHelp() {
        const isOpen = !this.helpOverlay.classList.contains('hidden');
        if (isOpen) {
            this.helpOverlay.classList.add('hidden');
            // 도움말을 닫을 때 게임 중이었으면 타이머 재개
            if (this.game.state === 'play' && this.timerInterval === 0) {
                this._startTimer();
            }
        }
        else {
            // 다른 오버레이 위에 도움말 표시 (start/pause/win 상태에서도 열 수 있음)
            this.helpOverlay.classList.remove('hidden');
            // 게임 진행 중이면 타이머 일시 정지
            if (this.game.state === 'play') {
                this._stopTimer();
            }
        }
    }
    // ── 타이머 ─────────────────────────────────────────────────────────────
    _startTimer() {
        this._stopTimer(); // 기존 interval 정리 (중복 호출 시 interval 누수 방지)
        this.startTime = Date.now() - this.elapsed * 1000;
        this.timerInterval = window.setInterval(() => {
            this.elapsed = (Date.now() - this.startTime) / 1000;
            this.elTimer.textContent = this._formatTime(this.elapsed);
        }, 1000);
    }
    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = 0;
        }
    }
    _formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }
    // ── 렌더 루프 ───────────────────────────────────────────────────────────
    _loop() {
        const step = () => {
            if (this.game.state !== 'idle') {
                this.renderer.render(this.game, this.input.getDragState(), this.elapsed, this.input.getKeyboardState());
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
}
/** MS FreeCell 1~32000 중 유일하게 풀 수 없는 게임 번호 */
GameController.UNSOLVABLE_GAMES = [11982];
// ─── 진입점 ────────────────────────────────────────────────────────────────
const controller = new GameController();
controller.start().catch(console.error);
//# sourceMappingURL=main.js.map