import { FreecellGame } from './freecell.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
import { GameStorage, formatSavedAt } from './storage.js';
import { nextGameNumber, randomLfsrState } from './lfsr.js';
import { DIFFICULTIES, DIFFICULTY_LABEL, isDifficulty, difficultyOf, nextGameNumberOfDifficulty, } from './difficulty.js';
import { req } from './dom.js';
const LEVEL_CHOICES = ['random', ...DIFFICULTIES];
const LEVEL_PREF_KEY = 'freecell-difficulty';
// ─── 게임 컨트롤러 ────────────────────────────────────────────────────────
class GameController {
    constructor() {
        /** 번호를 비워둔 새 게임이 어느 난이도에서 번호를 고를지 (localStorage 에 기억) */
        this._levelChoice = 'random';
        /** 선택 방식별 LFSR 상태 (없음 = 저장값 없음 → 첫 사용 시 랜덤 위치에서 시작) */
        this._lfsrStates = {};
        /** 자동 완료 진행 중 여부 (입력/재진입 차단용) */
        this._autoCompleting = false;
        this._autoCompleteTimer = 0;
        this.startTime = 0;
        this.elapsed = 0;
        this.timerInterval = 0;
        // 자동저장 디바운스 타이머
        this._saveTimer = 0;
        this._toastTimer = 0;
        /** 승리 애니메이션 종료 대기 타이머 (새 게임 시작 시 취소해야 함) */
        this._winOverlayTimer = 0;
        /** 실패 이펙트 종료 대기 폴링 타이머 (새 게임 시작 시 취소해야 함) */
        this._restartPollTimer = 0;
        /** 포기 이펙트가 끝나길 기다리는 폴링 타이머 */
        this._failOverlayTimer = 0;
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
            onAutoComplete: () => this._requestAutoComplete(),
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
        for (const choice of LEVEL_CHOICES) {
            const state = await this.storage.loadLfsrState(choice === 'random' ? undefined : choice);
            if (state !== null)
                this._lfsrStates[choice] = state;
        }
        this._levelChoice = this._loadLevelChoice();
        this._bindButtons();
        this._bindResize();
        this._bindPageHide();
        this._loop();
        // 저장된 게임이 있으면 이어하기 버튼 활성화
        await this._checkSavedGame();
    }
    _setupDOM() {
        this.canvas = req('game-canvas');
        this.elMoves = req('moves-value');
        this.elTimer = req('timer-value');
        this.elUndoBtn = req('btn-undo');
        this.elPauseBtn = req('btn-pause');
        this.startOverlay = req('start-overlay');
        this.pauseOverlay = req('pause-overlay');
        this.winOverlay = req('win-overlay');
        this.elWinMoves = req('win-moves');
        this.elWinTime = req('win-time');
        this.resumeBtn = req('overlay-continue-btn');
        this.elSavedInfo = req('saved-info');
        this.elSaveToast = req('save-toast');
        this.helpOverlay = req('help-overlay');
        this.confirmOverlay = req('confirm-overlay');
        this.elConfirmMsg = req('confirm-msg');
        this.elConfirmYesBtn = req('confirm-yes-btn');
        this.failOverlay = req('fail-overlay');
        this.elGiveUpBtn = req('btn-give-up');
        this.elAutoBtn = req('btn-auto-complete');
        this.gameNumberOverlay = req('game-number-overlay');
        this.elGameNumberInput = req('game-number-input');
    }
    _bindButtons() {
        req('btn-new').addEventListener('click', () => this._requestNewGame());
        req('btn-restart').addEventListener('click', () => this._requestRestart());
        this.elUndoBtn.addEventListener('click', () => this._undo());
        this.elPauseBtn.addEventListener('click', () => this._togglePause());
        // 음소거 토글
        const muteBtn = req('btn-mute');
        muteBtn.addEventListener('click', () => {
            this.sound.toggleMute();
            muteBtn.textContent = this.sound.muted ? '🔇' : '🔊';
            muteBtn.title = this.sound.muted ? '소리 켜기' : '소리 끄기';
        });
        // 시작 화면
        req('overlay-start-btn').addEventListener('click', async () => {
            await this.sound.init();
            this._showGameNumberDialog();
        });
        // 이어하기 버튼
        this.resumeBtn.addEventListener('click', async () => {
            await this.sound.init();
            await this._continueGame();
        });
        // 일시정지 재개
        req('overlay-resume-btn').addEventListener('click', () => {
            this._togglePause();
        });
        // 승리 후 새 게임
        req('overlay-win-new-btn').addEventListener('click', () => {
            this._showGameNumberDialog();
        });
        // 포기
        this.elGiveUpBtn.addEventListener('click', () => this._requestGiveUp());
        this.elAutoBtn.addEventListener('click', () => this._requestAutoComplete());
        // 포기 후: 같은 판 다시 하기 / 새 게임
        req('overlay-fail-retry-btn').addEventListener('click', () => {
            this._restartSameDeal();
        });
        req('overlay-fail-new-btn').addEventListener('click', () => {
            this._showGameNumberDialog();
        });
        // 도움말 닫기
        req('help-close-btn').addEventListener('click', () => {
            this._toggleHelp();
        });
        // 게임 번호 선택
        req('game-number-start-btn').addEventListener('click', () => {
            this._onGameNumberStart();
        });
        req('game-number-cancel-btn').addEventListener('click', () => {
            this._onGameNumberCancel();
        });
        // 난이도 선택 (번호를 비워둔 새 게임에 적용)
        for (const btn of this._levelButtons()) {
            btn.addEventListener('click', () => {
                const choice = btn.dataset.level;
                if (choice === 'random' || isDifficulty(choice))
                    this._setLevelChoice(choice);
                this.elGameNumberInput.focus();
            });
        }
        this._syncLevelButtons();
        this.elGameNumberInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')
                this._onGameNumberStart();
            if (e.key === 'Escape')
                this._onGameNumberCancel();
        });
        // 새 게임 / 다시 하기 확인 팝업
        req('confirm-yes-btn').addEventListener('click', () => {
            this.confirmOverlay.classList.add('hidden');
            if (this._confirmAction === 'restart') {
                this._doRestart();
            }
            else if (this._confirmAction === 'giveup') {
                this._doGiveUp();
            }
            else {
                this._showGameNumberDialog();
            }
        });
        req('confirm-no-btn').addEventListener('click', () => {
            this.confirmOverlay.classList.add('hidden');
            if (this._confirmFromPause) {
                // 원래 일시정지 상태였으면 → 일시정지 화면 복원
                this.pauseOverlay.classList.remove('hidden');
            }
            else {
                // 원래 플레이 중이었으면 → 게임 재개
                this.game.resume();
                this._updateUI();
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
        this.sound.init();
        this._stopTimer();
        this._cancelWinOverlayTimer();
        this._cancelRestartPoll();
        this.renderer.stopEffects();
        this.input.clearSelection();
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
            this._updateUI();
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
        else if (action === 'giveup') {
            this.elConfirmMsg.innerHTML = '정말 포기하시겠습니까?';
            this.elConfirmYesBtn.textContent = '✕ 포기';
        }
        else {
            this.elConfirmMsg.innerHTML = '진행 중인 게임을 포기하고<br>새 게임을 시작할까요?';
            this.elConfirmYesBtn.textContent = '✦ 새 게임';
        }
        if (this.game.state === 'play') {
            this.game.pause();
            this._updateUI();
            this._stopTimer();
            this.elPauseBtn.textContent = '▶ 계속';
        }
        this.pauseOverlay.classList.add('hidden');
        this.confirmOverlay.classList.remove('hidden');
    }
    /** 새 게임 요청: 게임 진행 중이면 확인 팝업, 아니면 게임 번호 선택으로 */
    _requestNewGame() {
        if (this._restartPending)
            return;
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
        // 승리/포기 이펙트 중에 열면, 예약된 결과 오버레이가 이 창 위로 뒤늦게 뜨지 않도록 취소
        // (취소 버튼을 누르면 _onGameNumberCancel 이 결과 오버레이를 바로 보여준다)
        this._cancelWinOverlayTimer();
        this._cancelFailOverlayTimer();
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
        // 비워두면 선택한 난이도에서 번호를 고른다 — LFSR 순서라 한 바퀴 동안 같은 판이 다시 나오지 않는다
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
    /**
     * LFSR을 전진시켜 다음 게임 번호를 고르고 새 상태를 저장한다 (풀 수 없는 판은 제외).
     * 난이도를 골랐으면 그 난이도의 번호만, 랜덤이면 1~32000 전체에서 고른다.
     * 상태는 선택 방식마다 따로 관리하므로 난이도를 바꿔도 각자의 순서가 이어진다.
     */
    _nextRandomGameNumber() {
        const choice = this._levelChoice;
        const state = this._lfsrStates[choice] ?? randomLfsrState();
        const r = choice === 'random'
            ? nextGameNumber(state, GameController.UNSOLVABLE_GAMES)
            : nextGameNumberOfDifficulty(choice, state, GameController.UNSOLVABLE_GAMES);
        this._lfsrStates[choice] = r.state;
        this.storage.saveLfsrState(r.state, choice === 'random' ? undefined : choice);
        return r.gameNumber;
    }
    // ── 난이도 선택 ─────────────────────────────────────────────────────────
    _levelButtons() {
        return Array.from(document.querySelectorAll('#level-select [data-level]'));
    }
    _syncLevelButtons() {
        for (const btn of this._levelButtons()) {
            const on = btn.dataset.level === this._levelChoice;
            btn.classList.toggle('selected', on);
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
        }
    }
    _setLevelChoice(choice) {
        this._levelChoice = choice;
        this._syncLevelButtons();
        try {
            localStorage.setItem(LEVEL_PREF_KEY, choice);
        }
        catch {
            // 저장소를 쓸 수 없어도(사생활 보호 모드 등) 이번 실행 동안은 선택이 유지된다
        }
    }
    _loadLevelChoice() {
        try {
            const v = localStorage.getItem(LEVEL_PREF_KEY);
            if (v === 'random' || isDifficulty(v))
                return v;
        }
        catch {
            // 읽을 수 없으면 기본값
        }
        return 'random';
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
        else if (s === 'lost') {
            this.failOverlay.classList.remove('hidden');
        }
        else if (s === 'pause') {
            this.pauseOverlay.classList.remove('hidden');
        }
        else {
            // play 상태였던 경우 (confirm → game-number-dialog 경로)
            this.game.resume();
            this._updateUI();
            this._startTimer();
            this.elPauseBtn.textContent = '⏸ 일시정지';
        }
    }
    /** 다시 하기 요청 */
    _requestRestart() {
        if (this._restartPending)
            return;
        if (this.game.state === 'play' || this.game.state === 'pause') {
            this._showConfirm('restart');
        }
        else if (this.game.state === 'lost') {
            // 이미 포기한 판 — 잃을 진행 상황이 없으므로 확인 없이 바로 다시 시작
            this._restartSameDeal();
        }
        // idle/win 상태에서는 다시 하기 의미 없음
    }
    // ── 포기 ───────────────────────────────────────────────────────────────
    /** 포기 요청: 진행 중인 판일 때만 확인 팝업 표시 */
    _requestGiveUp() {
        if (this._autoCompleting)
            return; // 자동 완료 중에는 곧 승리하므로 무시
        if (this._restartPending)
            return;
        if (this.game.state === 'play' || this.game.state === 'pause') {
            this._showConfirm('giveup');
        }
    }
    /** 포기 확정: 실패 이펙트 후 결과(패배) 오버레이 표시 */
    _doGiveUp() {
        if (!this.game.giveUp())
            return;
        this._stopTimer();
        this._cancelWinOverlayTimer();
        this._cancelRestartPoll();
        this._cancelPendingSave();
        this.input.clearSelection();
        this.storage.clear(); // 포기한 판은 이어하기 대상이 아님
        this.elPauseBtn.textContent = '⏸ 일시정지';
        this._hideAllOverlays();
        this._updateUI();
        const n = this.game.gameNumber;
        req('fail-game').textContent = n > 0 ? `#${n}` : '랜덤';
        req('fail-moves').textContent = String(this.game.moveCount);
        req('fail-time').textContent = this._formatTime(this.elapsed);
        // 초기 배열을 모르는 판(옛 저장본의 번호 없는 게임)은 같은 판 다시 하기를 숨김
        req('overlay-fail-retry-btn')
            .classList.toggle('hidden', !this.game.canRestart);
        this.sound.play('lose');
        this.renderer.startFailEffect(this.game);
        // 이펙트가 끝나면 오버레이 표시 (안전장치로 최대 8초 대기)
        const startedAt = Date.now();
        const showWhenDone = () => {
            if (!this.renderer.isFailAnimating || Date.now() - startedAt > 8000) {
                this._failOverlayTimer = 0;
                this.failOverlay.classList.remove('hidden');
            }
            else {
                this._failOverlayTimer = window.setTimeout(showWhenDone, 100);
            }
        };
        this._failOverlayTimer = window.setTimeout(showWhenDone, 100);
    }
    /** 예약된 패배 오버레이 표시 취소 (포기 직후 새 게임/다시 하기 시 누출 방지) */
    _cancelFailOverlayTimer() {
        if (this._failOverlayTimer) {
            clearTimeout(this._failOverlayTimer);
            this._failOverlayTimer = 0;
        }
    }
    /** 예약된 자동저장 취소 (포기 직후 뒤늦은 저장으로 이어하기가 되살아나는 것 방지) */
    _cancelPendingSave() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = 0;
        }
    }
    /** 포기한 판을 이펙트 없이 같은 배열로 처음부터 다시 시작 */
    _restartSameDeal() {
        if (!this.game.canRestart)
            return;
        this.sound.init();
        this._stopTimer();
        this._stopAutoComplete();
        this._cancelFailOverlayTimer();
        this._cancelRestartPoll();
        this.renderer.stopEffects();
        this.input.clearSelection();
        if (!this.game.restart())
            return;
        this.elapsed = 0;
        this._startTimer();
        this._hideAllOverlays();
        this.elPauseBtn.textContent = '⏸ 일시정지';
        this._updateUI();
        this._updateGameNumberDisplay();
        this.storage.clear();
        this._scheduleSave();
    }
    /** 실패 이펙트 후 동일 배열로 재시작 */
    _doRestart() {
        // 초기 배열을 모를 때는 이펙트/리셋 없이 게임 재개 (저장 데이터 보호)
        if (!this.game.canRestart) {
            this.game.resume();
            this._updateUI();
            this._startTimer();
            this.elPauseBtn.textContent = '⏸ 일시정지';
            return;
        }
        this._stopTimer();
        this._stopAutoComplete();
        this._cancelWinOverlayTimer();
        // 대기 타이머가 겹치면 먼저 만든 쪽이 지워지지 않고 남아 판을 계속 초기화한다
        this._cancelRestartPoll();
        this.input.clearSelection();
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
    /**
     * 다시 하기 이펙트가 끝나길 기다리는 중인지.
     * 이 동안 판은 pause 상태로 멈춰 있고 보드는 보이지 않으므로,
     * 일시정지 해제·새 게임·다시 하기·포기 요청을 받지 않는다 (곧 같은 판이 새로 시작된다).
     */
    get _restartPending() { return this._restartPollTimer !== 0; }
    _cancelRestartPoll() {
        if (this._restartPollTimer) {
            clearInterval(this._restartPollTimer);
            this._restartPollTimer = 0;
        }
    }
    _newGame(gameNumber) {
        // 키보드(N)로 시작하는 경로에서도 사운드가 초기화되도록 보장 (버튼 클릭 없이 진입 가능)
        this.sound.init();
        this._stopTimer();
        // 자동 올리기 도중 새 게임을 시작하면 새 판의 카드를 계속 올리게 되므로 먼저 중단
        this._stopAutoComplete();
        this._cancelWinOverlayTimer();
        this._cancelFailOverlayTimer();
        this._cancelRestartPoll();
        this.renderer.stopEffects();
        this.input.clearSelection();
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
        const level = difficultyOf(n);
        el.textContent = n > 0 ? `#${n}${level ? ' ' + DIFFICULTY_LABEL[level] : ''}` : '';
    }
    _undo() {
        // 자동 완료 중 undo는 다음 tick이 즉시 같은 수를 재실행해 무효화되므로 차단
        if (this._autoCompleting)
            return;
        // 승리 애니메이션 중 undo는 타이머/저장/오버레이와 상태가 어긋나므로 play 상태에서만 허용
        if (this.game.state !== 'play')
            return;
        if (!this.game.canUndo)
            return;
        this.game.undo();
        // 드래그 중이던 카드는 되돌리기 전 보드 기준이라, 그대로 놓으면 보이던 것과 다른 카드가 옮겨질 수 있다
        this.input.clearSelection();
        this.sound.play('card_flip');
        this._updateUI();
        this._scheduleSave();
    }
    _togglePause() {
        if (this._restartPending)
            return;
        if (this.game.state === 'idle' || this.game.state === 'win' || this.game.state === 'lost')
            return;
        if (this.game.state === 'play') {
            this.game.pause();
            this._updateUI();
            this._stopTimer();
            this.pauseOverlay.classList.remove('hidden');
            this.elPauseBtn.textContent = '▶ 계속';
            // 일시정지 시 즉시 저장
            const snap = this.game.serialize(this.elapsed);
            this.storage.save(snap);
        }
        else if (this.game.state === 'pause') {
            this.game.resume();
            this._updateUI();
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
    /**
     * 수동 자동 올리기 (버튼 / A 키): 지금 올릴 수 있는 카드를 연쇄까지 모두 Foundation으로 올린다.
     * 판을 끝낼 수 없는 상태여도 동작하며, 더 올릴 카드가 없으면 멈춘다.
     */
    _requestAutoComplete() {
        if (this._autoCompleting)
            return;
        if (this.game.state !== 'play')
            return;
        if (this.renderer.isFailAnimating)
            return; // 다시 하기 이펙트 중
        if (!this.game.hasFoundationMove()) {
            this.sound.play('invalid');
            return;
        }
        this._startAutoComplete(true);
    }
    /**
     * 한 장씩 애니메이션처럼 Foundation으로 이동시킨다. 더 올릴 카드가 없거나 승리하면 종료.
     * @param immediate 첫 장을 지연 없이 바로 올릴지 (수동 요청 시 즉시 반응)
     */
    _startAutoComplete(immediate = false) {
        this._autoCompleting = true;
        const tick = () => {
            this._autoCompleteTimer = 0;
            if (this.game.autoMoveOne() === null) {
                // 더 올릴 카드 없음 (또는 일시정지 등으로 중단) — 여기까지의 진행을 저장
                this._stopAutoComplete();
                this._scheduleSave();
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
        if (immediate)
            tick();
        else
            this._autoCompleteTimer = window.setTimeout(tick, 120);
    }
    _stopAutoComplete() {
        const wasRunning = this._autoCompleting;
        this._autoCompleting = false;
        if (this._autoCompleteTimer) {
            clearTimeout(this._autoCompleteTimer);
            this._autoCompleteTimer = 0;
        }
        if (wasRunning)
            this._updateUI(); // 버튼 활성 상태 복구
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
                this._winOverlayTimer = 0;
                this.winOverlay.classList.remove('hidden');
            }
            else {
                this._winOverlayTimer = window.setTimeout(showWhenDone, 250);
            }
        };
        this._winOverlayTimer = window.setTimeout(showWhenDone, 1500);
    }
    /** 예약된 승리 오버레이 표시 타이머 취소 (승리 직후 새 게임 시작 시 누출 방지) */
    _cancelWinOverlayTimer() {
        if (this._winOverlayTimer) {
            clearTimeout(this._winOverlayTimer);
            this._winOverlayTimer = 0;
        }
    }
    // ── UI 업데이트 ─────────────────────────────────────────────────────────
    _updateUI() {
        this.elMoves.textContent = String(this.game.moveCount);
        this.elUndoBtn.disabled = !this.game.canUndo || this.game.state === 'win' || this.game.state === 'lost';
        this.elGiveUpBtn.disabled = this.game.state !== 'play' && this.game.state !== 'pause';
        this.elAutoBtn.disabled = this._autoCompleting || !this.game.hasFoundationMove();
    }
    _hideAllOverlays() {
        this.startOverlay.classList.add('hidden');
        this.pauseOverlay.classList.add('hidden');
        this.winOverlay.classList.add('hidden');
        this.failOverlay.classList.add('hidden');
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
            // 마지막 1초 갱신 이후 흐른 시간까지 반영 (안 하면 멈출 때마다 1초 미만이 버려진다)
            this.elapsed = (Date.now() - this.startTime) / 1000;
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