package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;

import com.chobocho.freecell.Freecell;
import java.util.LinkedList;

public class PauseDrawEngineImpl implements DrawEngine {
    final static String TAG = "PauseDrawEngineImpl";
    int width = 100;
    int height = 150;
    int cardCap = 20;
    int screenW = 910;

    public PauseDrawEngineImpl() {
    }

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        //g.drawImage(buttonImages[CardGameGui.RESME_GAME_IMAGE], (screenW-200)/2, 250, null);
       //g.drawImage(buttonImages[CardGameGui.NEW_GAME_IMAGE], (screenW-200)/2, 450, null);
    }
}
