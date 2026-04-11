import { FreecellGame } from './freecell.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { SoundManager } from './sound.js';
// ─── 게임 컨트롤러 ────────────────────────────────────────────────────────
class GameController {
    constructor() {
        this._rafId = 0;
        this.startTime = 0;
        this.elapsed = 0;
        this.timerInterval = 0;
        this.game = new FreecellGame();
        this.sound = new SoundManager();
        this._setupDOM();
        this.renderer = new Renderer(this.canvas);
        this.input = new InputHandler(this.canvas, this.game, this.renderer, {
            onNewGame: () => this._newGame(),
            onUndo: () => this._undo(),
            onPause: () => this._togglePause(),
            onMoveCard: (from, to, count) => this._handleMove(from, to, count),
            onAutoMove: (from) => this._handleAutoMove(from),
        });
    }
    // ── 초기화 ─────────────────────────────────────────────────────────────
    async start() {
        await this.renderer.init();
        this._bindButtons();
        this._bindResize();
        this._loop();
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
    }
    _bindButtons() {
        document.getElementById('btn-new').addEventListener('click', () => this._newGame());
        this.elUndoBtn.addEventListener('click', () => this._undo());
        this.elPauseBtn.addEventListener('click', () => this._togglePause());
        // 오버레이 버튼
        document.getElementById('overlay-start-btn').addEventListener('click', async () => {
            await this.sound.init();
            this._newGame();
        });
        document.getElementById('overlay-resume-btn').addEventListener('click', () => {
            this._togglePause();
        });
        document.getElementById('overlay-win-new-btn').addEventListener('click', () => {
            this._newGame();
        });
    }
    _bindResize() {
        const ro = new ResizeObserver(() => {
            this.renderer.resize();
        });
        ro.observe(this.canvas);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.renderer.resize(), 100);
        });
    }
    // ── 게임 흐름 ───────────────────────────────────────────────────────────
    _newGame() {
        this._stopTimer();
        this.game.deal();
        this.elapsed = 0;
        this._startTimer();
        this._hideAllOverlays();
        this._updateUI();
    }
    _undo() {
        if (!this.game.canUndo)
            return;
        this.game.undo();
        this.sound.play('card_flip');
        this._updateUI();
    }
    _togglePause() {
        if (this.game.state === 'idle' || this.game.state === 'win')
            return;
        if (this.game.state === 'play') {
            this.game.pause();
            this._stopTimer();
            this.pauseOverlay.classList.remove('hidden');
            this.elPauseBtn.textContent = '▶ 계속';
        }
        else if (this.game.state === 'pause') {
            this.game.resume();
            this._startTimer();
            this.pauseOverlay.classList.add('hidden');
            this.elPauseBtn.textContent = '⏸ 일시정지';
        }
    }
    _handleMove(from, to, count) {
        // 실제로 이동 가능한 장수 결정 (maxMovableCount 존중)
        const maxCount = this.game.maxMovableCount(this.game.emptyFreeCellCount(), this.game.emptyTableauCount(to));
        const actualCount = Math.min(count, maxCount);
        const ok = this.game.moveCard(from, to, actualCount);
        if (ok) {
            this.sound.play('card_place');
            this._updateUI();
            if (this.game.state === 'win') {
                this._onWin();
            }
        }
        else {
            this.sound.play('invalid');
        }
        return ok;
    }
    _handleAutoMove(from) {
        const result = this.game.autoMoveToFoundation(from);
        if (result !== null) {
            this.sound.play('card_place');
            this._updateUI();
            if (this.game.state === 'win')
                this._onWin();
        }
    }
    _onWin() {
        this._stopTimer();
        this.sound.play('win');
        this.renderer.startWinEffect(this.game);
        // 승리 통계 표시
        this.elWinMoves.textContent = String(this.game.moveCount);
        this.elWinTime.textContent = this._formatTime(this.elapsed);
        setTimeout(() => {
            this.winOverlay.classList.remove('hidden');
        }, 2000);
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
    }
    // ── 타이머 ─────────────────────────────────────────────────────────────
    _startTimer() {
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
//# sourceMappingURL=main.js.map