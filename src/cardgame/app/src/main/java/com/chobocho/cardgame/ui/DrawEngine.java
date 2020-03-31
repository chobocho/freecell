package com.chobocho.cardgame.ui;
import android.graphics.Bitmap;
import android.graphics.Canvas;

import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public interface DrawEngine {
    void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages);
}
