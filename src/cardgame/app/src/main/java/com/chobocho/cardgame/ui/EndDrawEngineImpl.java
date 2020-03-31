package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;

import com.chobocho.card.Card;
import com.chobocho.deck.Deck;
import com.chobocho.deck.PlayDeck;
import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class EndDrawEngineImpl implements DrawEngine {
    final static String TAG = "EndDrawEngineImpl";
    final static int CARD_NONE_IMAGE = 53;
    int width = 100;
    int screenW = 910;

    public EndDrawEngineImpl() {

    }

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        onDrawResultDeck(g, cardImages, game);
        //g.drawImage(buttonImages[CardGameGui.NEW_GAME_IMAGE], (screenW-200)/2, 300, null);
    }

    private void onDrawResultDeck(Canvas g, Bitmap[] cardImages, Freecell game) {
        //WinLog.i(TAG, "onDrawResultDeck");
        Deck deck = new PlayDeck();

        for (int i = 0; i < 4; i++) {
            deck = game.getDeck(0);

            if (!deck.isEmpty()) {
                Card card = deck.get(i);
                if (card == null) {
                    continue;
                }
                int imgNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();
                //g.drawImage(cardImages[imgNumber], 10 + width * i + 10 * i, 10, null);
            }
        }

        //g.drawImage(cardImages[CARD_NONE_IMAGE], 70+width*6, 10, null);
    }
}
