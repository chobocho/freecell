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
    final static int CARD_NONE_IMAGE = 53;
    int width = 100;
    int height = 150;
    int cardCap = 20;
    int screenW = 910;

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
       //g.drawImage(buttonImages[CardGameGui.PLAY_GAME_IMAGE], (screenW-200)/2, 300, null);
    }

    private void onDrawBoardDeck(Canvas g, Bitmap[] cardImages, Freecell game) {

    }
}
