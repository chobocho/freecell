package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;

import com.chobocho.freecell.Freecell;
import java.util.LinkedList;

public class IdleDrawEngineImpl implements DrawEngine {
    final static String TAG = "IdleDrawEngineImpl";
    int screenW = 1080;
    int screenH = 1920;
    int PLAY_GAME_IMAGE = 1;

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        Paint paint = new Paint();
        g.drawBitmap(buttonImages[PLAY_GAME_IMAGE], null, new Rect( (screenW-400)/2, (screenH-200)/2,  (screenW-400)/2+400, (screenH-200)/2+200), paint);
    }

}
