package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;

import com.chobocho.cardgame.AndroidLog;
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
        int x1 = (screenW-400)/2;
        int y1 = (screenH-200)/2;
        g.drawBitmap(buttonImages[PLAY_GAME_IMAGE], null, new Rect( x1,  y1, x1+400, y1+200), paint);
        AndroidLog.i(TAG, "Event:" + Integer.toString(x1) + " : " + Integer.toString(y1));

        paint.setTextSize(12);
        paint.setColor(Color.BLUE);
        g.drawText("Version: " + Freecell.Version, 50, screenH - 180, paint);
    }

}
