package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;

import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class CommonDrawEngineImpl implements DrawEngine {

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        onDrawCommon(g, cardImages, buttonImages);
    }

    private void onDrawCommon(Canvas g, Bitmap[] cardImages, Bitmap[] buttonImages) {
        int screenW = 1080;
        int screenH = 1920;
        int CARD_BG_IMAGE = 0;
        int CARD_NONE_IMAGE = 53;
        int CARD_ABG_IMAGE = 54;

        int width = 120;
        int height = 180;

        Paint paint = new Paint();
        paint.setColor(Color.rgb(88, 214, 141));
        g.drawRect(0, 0, g.getWidth(), g.getHeight(), paint);

        // Result Deck
        for (int i = 0; i < 4; i++) {
            g.drawBitmap(cardImages[CARD_ABG_IMAGE], null, new Rect(10 + (width + 10) * i, 10,  (width + 10) * (i+1), 10 + height), paint);
        }

        // Empty Deck
        for (int i = 0; i < 4; i++) {
            g.drawBitmap(cardImages[CARD_BG_IMAGE], null, new Rect(10 + (width + 10) * (i+4), 10,  (width + 10) * (i+5), 10 + height), paint);
        }

        for (int i = 0; i < 8; i++) {
            g.drawBitmap(cardImages[CARD_NONE_IMAGE], null, new Rect(10 + (width + 10) * i, 40+height,  (width + 10) * (i+1), 40 + height*2 ), paint);
        }

    }
}
