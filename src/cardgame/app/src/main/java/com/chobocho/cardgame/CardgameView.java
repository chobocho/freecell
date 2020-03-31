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
import android.view.MotionEvent;
import android.view.View;


import com.chobocho.cardgame.cmd.DeckPositoinManagerImpl;
import com.chobocho.cardgame.ui.CommonDrawEngineImpl;
import com.chobocho.cardgame.ui.DrawEngine;
import com.chobocho.cardgame.ui.EndDrawEngineImpl;
import com.chobocho.cardgame.ui.IdleDrawEngineImpl;
import com.chobocho.cardgame.ui.PauseDrawEngineImpl;
import com.chobocho.cardgame.ui.PlayDrawEngineImpl;
import com.chobocho.command.CommandEngine;
import com.chobocho.command.CommandFactory;
import com.chobocho.command.DeckPositoinManager;
import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.GameObserver;
import com.chobocho.freecell.GameState;

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
    Bitmap[]  buttonImage = new Bitmap[3];

    private static final int EMPTY_MESSAGE = 0;
    private HandlerThread playerHandlerThread;
    private Handler playerHandler;
    private int gameSpeed = 1000;
    private int highScore = 0;

    public CardgameView(Context context, Freecell freecell, CommandEngine cmdEngine) {
        super(context);
        this.mContext = context;
        this.freecell = freecell;
        this.cmdEngine = cmdEngine;
        isSetScale = false;
        needScaleCanvas = false;

        this.idleDrawEngine = new IdleDrawEngineImpl();
        this.playDrawEngine = new PlayDrawEngineImpl();
        this.pauseDrawEngine = new PauseDrawEngineImpl();
        this.endDrawEngine = new EndDrawEngineImpl();
        this.commonDrawEngine = new CommonDrawEngineImpl();
        this.deckPositoinManager = new DeckPositoinManagerImpl();

        drawEngine = this.idleDrawEngine;
        loadImage();

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
                R.drawable.resume
        };

        for (int i = 0; i < 3; i++) {
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

        commonDrawEngine.onDraw(canvas, freecell,null, cardImages, buttonImage);
        drawEngine.onDraw(canvas, freecell, null, cardImages, buttonImage);
    }

    public boolean onTouchEvent(MotionEvent event) {
        Log.d(LOG_TAG, ">> X: " + event.getX() + " Y: " + event.getY());

        if (freecell == null) {
            return false;
        }
        if (MotionEvent.ACTION_DOWN != event.getAction()) {
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
        return false;
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