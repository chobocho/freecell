package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;

import com.chobocho.cardgame.BoardProfile;
import com.chobocho.freecell.Freecell;
import java.util.LinkedList;

public class PauseDrawEngineImpl implements DrawEngine {
    final static String TAG = "PauseDrawEngineImpl";

    int NEW_GAME_IMAGE = 0;
    int RESUME_GAME_IMAGE = 2;

    BoardProfile boardProfile;
    int screenW = 1080;
    int screenH = 1920;

    int width = 120;
    int height = 180;
    int gap = 10;

    public PauseDrawEngineImpl(BoardProfile boardProfile) {
        this.boardProfile = boardProfile;
        screenW = boardProfile.screenWidth();
        screenH = boardProfile.screenHeight();
        width = boardProfile.cardWidth();
        height = boardProfile.cardHeight();
        gap = boardProfile.cardGap();
    }

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        Paint paint = new Paint();
        g.drawBitmap(buttonImages[RESUME_GAME_IMAGE], null, new Rect( (screenW-400)/2, (screenH-200)/2-300,  (screenW-400)/2+400, (screenH-200)/2-100), paint);
        g.drawBitmap(buttonImages[NEW_GAME_IMAGE], null, new Rect( (screenW-400)/2, (screenH-200)/2+300,  (screenW-400)/2+400, (screenH-200)/2+500), paint);
    }

}
