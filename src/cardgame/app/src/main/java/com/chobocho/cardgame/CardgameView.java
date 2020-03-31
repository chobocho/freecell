package com.chobocho.cardgame;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Message;
import android.util.Log;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.View;


import com.chobocho.card.Card;
import com.chobocho.cardgame.cmd.DeckPositoinManagerImpl;
import com.chobocho.cardgame.ui.CommonDrawEngineImpl;
import com.chobocho.cardgame.ui.DrawEngine;
import com.chobocho.cardgame.ui.EndDrawEngineImpl;
import com.chobocho.cardgame.ui.IdleDrawEngineImpl;
import com.chobocho.cardgame.ui.PauseDrawEngineImpl;
import com.chobocho.cardgame.ui.PlayDrawEngineImpl;
import com.chobocho.command.CardPosition;
import com.chobocho.command.CommandEngine;
import com.chobocho.command.CommandFactory;
import com.chobocho.command.DeckPositoinManager;
import com.chobocho.command.PlayCommand;
import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.GameObserver;
import com.chobocho.freecell.GameState;

import java.util.LinkedList;

import static android.content.Context.MODE_PRIVATE;

public class CardgameView extends View implements GameObserver {
    private String LOG_TAG = this.getClass().getName();
    private Context mContext;

    private float scaleX = 1.0f;
    private float scaleY = 1.0f;
    private boolean isSetScale = false;
    private boolean needScaleCanvas = false;

    private Freecell freecell;
    private CommandEngine cmdEngine;

    private DrawEngine drawEngine;
    private DrawEngine idleDrawEngine;
    private DrawEngine playDrawEngine;
    private DrawEngine pauseDrawEngine;
    private DrawEngine endDrawEngine;
    private DrawEngine commonDrawEngine;
    private CommandFactory commandFactory;
    private DeckPositoinManager deckPositoinManager;

    Bitmap[] cardImages   = new Bitmap[55];
    Bitmap[]  buttonImage = new Bitmap[5];

    private static final int EMPTY_MESSAGE = 0;
    private HandlerThread playerHandlerThread;
    private Handler playerHandler;
    private int gameSpeed = 1000;
    private int highScore = 0;

    public CardPosition StartPos;
    public CardPosition EndPos;
    public int currentMouseX = 0;
    public int currentMouseY = 0;
    public int mouseDx;
    public int mouseDy;

    private boolean isMovingCard = false;
    public LinkedList<Integer> hideCard = new LinkedList<Integer>();

    public CardgameView(Context context, Freecell freecell, CommandEngine cmdEngine) {
        super(context);
        this.mContext = context;
        this.freecell = freecell;
        this.cmdEngine = cmdEngine;
        isSetScale = false;
        needScaleCanvas = false;
        loadImage();

        this.idleDrawEngine = new IdleDrawEngineImpl();
        this.playDrawEngine = new PlayDrawEngineImpl();
        this.pauseDrawEngine = new PauseDrawEngineImpl();
        this.endDrawEngine = new EndDrawEngineImpl();
        this.commonDrawEngine = new CommonDrawEngineImpl();
        this.deckPositoinManager = new DeckPositoinManagerImpl();

        drawEngine = this.idleDrawEngine;

        commandFactory = new AndroidCommandFactory();
        this.freecell.register(commandFactory);

       //createPlayerThread();
    }

    private void loadImage() {
        int[] imageName = {
                R.drawable.bg,
                R.drawable.ca,
                R.drawable.c2,
                R.drawable.c3,
                R.drawable.c4,
                R.drawable.c5,
                R.drawable.c6,
                R.drawable.c7,
                R.drawable.c8,
                R.drawable.c9,
                R.drawable.c10,
                R.drawable.cj,
                R.drawable.cq,
                R.drawable.ck,
                R.drawable.da,
                R.drawable.d2,
                R.drawable.d3,
                R.drawable.d4,
                R.drawable.d5,
                R.drawable.d6,
                R.drawable.d7,
                R.drawable.d8,
                R.drawable.d9,
                R.drawable.d10,
                R.drawable.dj,
                R.drawable.dq,
                R.drawable.dk,
                R.drawable.ha,
                R.drawable.h2,
                R.drawable.h3,
                R.drawable.h4,
                R.drawable.h5,
                R.drawable.h6,
                R.drawable.h7,
                R.drawable.h8,
                R.drawable.h9,
                R.drawable.h10,
                R.drawable.hj,
                R.drawable.hq,
                R.drawable.hk,
                R.drawable.sa,
                R.drawable.s2,
                R.drawable.s3,
                R.drawable.s4,
                R.drawable.s5,
                R.drawable.s6,
                R.drawable.s7,
                R.drawable.s8,
                R.drawable.s9,
                R.drawable.s10,
                R.drawable.sj,
                R.drawable.sq,
                R.drawable.sk,
                R.drawable.none,
                R.drawable.abg
        };

        for (int i = 0; i < 55; i++) {
            cardImages[i] = BitmapFactory.decodeResource(mContext.getResources(), imageName[i]);
        }

        int[] buttonImageName = {
                R.drawable.newgame,
                R.drawable.start,
                R.drawable.resume,
                R.drawable.pause,
                R.drawable.revert
        };

        for (int i = 0; i < 5; i++) {
            buttonImage[i] = BitmapFactory.decodeResource(mContext.getResources(), buttonImageName[i]);
        }

    }

    private void createPlayerThread() {
        Log.d(LOG_TAG,"createPlayerThread");
        playerHandlerThread = new HandlerThread("Player Processing Thread");
        playerHandlerThread.start();
        playerHandler = new Handler(playerHandlerThread.getLooper()){
            @Override
            public void handleMessage(Message msg){
                if (freecell != null && freecell.isPlayState()) {
                    if (playerHandler.hasMessages(EMPTY_MESSAGE)) {
                        playerHandler.removeMessages(EMPTY_MESSAGE);
                    }
                    playerHandler.sendEmptyMessageDelayed(EMPTY_MESSAGE, gameSpeed);
                }
            }
        };
    }

    public void startGame() {
        playerHandler.sendEmptyMessage(EMPTY_MESSAGE);
    }

    public void pauseGame() {
        Log.d(LOG_TAG, "pauseGame");
        if (playerHandler.hasMessages(EMPTY_MESSAGE)) {
            playerHandler.removeMessages(EMPTY_MESSAGE);
            Log.d(LOG_TAG, "Removed event");
        }
        if (playerHandlerThread != null) {
            playerHandlerThread.quit();
        }
        saveScore();
    }

    public void resumeGame() {
        Log.d(LOG_TAG, "resumeGame");
        createPlayerThread();
    }

    public void update() {
        Log.d(LOG_TAG, "View.update()");
        invalidate();
    }

    public void updateState(int state) {
        Log.i(LOG_TAG, "STATE: " + state);
        switch (state) {
            case GameState.IDLE_STATE:
                drawEngine = idleDrawEngine;
                break;
            case GameState.PLAY_STATE:
                drawEngine = playDrawEngine;
                break;
            case GameState.PAUSE_STATE:
                drawEngine = pauseDrawEngine;
                break;
            case GameState.END_STATE:
                drawEngine = endDrawEngine;
                break;
            default:
                break;
        }
        invalidate();
    }

    public void onDraw(Canvas canvas) {
        if (freecell == null) {
            return;
        }

        Paint paint = new Paint();

        if (!isSetScale) {
            scaleX = canvas.getWidth() / 1080f;
            scaleY = canvas.getHeight() / 1920f;
            isSetScale = true;

            if (scaleX <= 0.999f) {
                needScaleCanvas = true;
                Log.d(LOG_TAG, "Resolution of device is smaller than 1080");
            }
        }

        if (needScaleCanvas) {
            canvas.scale(scaleX, scaleY);
        }

        commonDrawEngine.onDraw(canvas, freecell, hideCard, cardImages, buttonImage);
        drawEngine.onDraw(canvas, freecell, hideCard, cardImages, buttonImage);

        int width = 120;
        int height = 180;
        if (isMovingCard) {
            for (int i = 0; i < hideCard.size(); i++) {
                int px = currentMouseX - mouseDx;
                int py = (currentMouseY - mouseDy) + i * 60;
                canvas.drawBitmap(cardImages[hideCard.get(i)], null, new Rect(px, py,  px+width, py+height), paint);
            }
        }

        int screenW = 1080;
        int screenH = 1920;

        if (freecell.isPlayState()) {
            paint.setColor(Color.BLUE);
            paint.setTextSize(60);
            canvas.drawText("Move: " + Integer.toString(freecell.getMoveCount()), 50, screenH - 80, paint);
        }
    }

    public boolean onTouchEvent(MotionEvent event) {
        Log.d(LOG_TAG, ">> X: " + event.getX() + " Y: " + event.getY());

        if (freecell == null) {
            return false;
        }

        Log.d(LOG_TAG, ">> scaleX: " + scaleX + " scaleY: " + scaleY);

        int x = (int) (event.getX());
        int y = (int) (event.getY());

        if (needScaleCanvas) {
            x = (int) (x / scaleX);
            y = (int) (y / scaleY);
        }

        Log.d(LOG_TAG, ">> X: " + x + " Y: " + y);

        Log.d(LOG_TAG, Integer.toString(event.getAction()));

        if (MotionEvent.ACTION_UP == event.getAction()) {
            onTouchReleased(x, y);
        }

        if (MotionEvent.ACTION_DOWN == event.getAction()) {
            onTouchPressed(x, y);
        }

        if (MotionEvent.ACTION_MOVE == event.getAction()) {
            onTouchMove(x, y);
        }
        return true;
    }

    private void onTouchPressed(int mouseX, int mouseY) {
        Log.i(LOG_TAG, "Mouse Pressed " + mouseX + ":" + mouseY);
        mouseDx = 0;
        mouseDy = 0;

        deckPositoinManager.initCardPosition(freecell);

        StartPos = deckPositoinManager.getCardInfo(mouseX, mouseY);

        if (StartPos != null) {
            if (!freecell.isMovableDeck(StartPos.deck)) {
                StartPos = null;
                return;
            }
            makeHideCardList();
            isMovingCard = true;
            mouseDx = mouseX - StartPos.x1;
            mouseDy = mouseY - StartPos.y1;
            Log.i(LOG_TAG, "StartDeck :" + StartPos.toString());
        }
    }

    private boolean runCommand(CardPosition pos) {
        if (pos == null) {
            return false;
        }
        PlayCommand cmd = commandFactory.CreateCommand(StartPos.deck, StartPos.position, pos.deck, pos.position);

        if (cmdEngine.runCommand(cmd)) {
            update();
            return true;
        }

        return false;
    }


    public void onTouchReleased(int mouseX, int mouseY) {
        Log.i(LOG_TAG, "Mouse released " + mouseX + ":" + mouseY);
        isMovingCard = false;

        if (StartPos == null) {
            PlayCommand cmd = commandFactory.CreateCommand(CommandFactory.MOUSE_CLICK_EVENT, mouseX, mouseY);
            if (cmdEngine.runCommand(cmd)) {
                update();
            }
            return;
        }

        Log.i(LOG_TAG, "Mouse released " + mouseX + ":" + mouseY);

        hideCard.clear();

        // Check left top of moving card
        EndPos = deckPositoinManager.getCardInfo(mouseX - mouseDx, mouseY - mouseDy);
        if (runCommand(EndPos)) {
            return;
        }

        // Check the mouse X,Y
        EndPos = deckPositoinManager.getCardInfo(mouseX, mouseY);
        if (runCommand(EndPos)) {
            return;
        }

        // Check Right top of moving card
        EndPos = deckPositoinManager.getCardInfo(mouseX + (100 - mouseDx), mouseY - mouseDy);
        if (runCommand(EndPos)) {
            return;
        }

        if (freecell.isMovableDeck(EndPos.deck) && (StartPos.deck == EndPos.deck)) {
            for (int i = 0; i < 4; i++) {
                PlayCommand moveCmd = commandFactory.CreateCommand(EndPos.deck, 0, i + Freecell.RESULT_DECK_1, 0);
                if (cmdEngine.runCommand(moveCmd)) {
                    update();
                    return;
                }
            }

            for (int i = 0; i < 8; i++) {
                if (EndPos.deck == (i+Freecell.BOARD_DECK_1)) {
                    continue;
                }
                PlayCommand moveCmd = commandFactory.CreateCommand(EndPos.deck, 0, i + Freecell.BOARD_DECK_1, 0);
                if (cmdEngine.runCommand(moveCmd)) {
                    update();
                    return;
                }
            }

            for (int i = 0; i < 4; i++) {
                PlayCommand moveCmd = commandFactory.CreateCommand(EndPos.deck, 0, i + Freecell.EMPTY_DECK_1, 0);
                if (cmdEngine.runCommand(moveCmd)) {
                    update();
                    return;
                }
            }
        }
    }

    private void onTouchMove(int mouseX, int mouseY) {
        if (isMovingCard) {
            currentMouseX = mouseX;
            currentMouseY = mouseY;
            update();
        }
    }

    private void makeHideCardList() {
        hideCard.clear();

        if (drawEngine != playDrawEngine) {
            return;
        }

        int deck = StartPos.deck;
        int moveCount = StartPos.position + 1;

        //WinLog.i(TAG, "paint " + Integer.toString(deck) + ":" + Integer.toString(moveCount));

        for (int i = 0; i < moveCount; i++) {
            Card card = freecell.getDeck(deck).get(i);
            if (card != null) {
                // WinLog.i(TAG, card.toString());
                int cardNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();
                hideCard.push(cardNumber);
                // WinLog.i(TAG, card.toString() + " : " + Integer.toString(imageNumber));
            } else {
                Log.i(LOG_TAG, "Card is null!");
            }
        }
    }


    private void loadHIghScore() {
        Log.d(LOG_TAG, "load()");
        SharedPreferences pref = mContext.getSharedPreferences("choboTetris", MODE_PRIVATE);
        this.highScore = pref.getInt("highscore", 0);
    }

    private void saveScore() {
        //Log.d(LOG_TAG, "saveScore()");
        //if (this.highScore > player.getHighScore()) {
        //    return;
        //}
        //SharedPreferences pref = mContext.getSharedPreferences("choboTetris", MODE_PRIVATE);
        //SharedPreferences.Editor edit = pref.edit();

        //edit.putInt("highscore", player.getHighScore());
        //edit.commit();
    }
}
