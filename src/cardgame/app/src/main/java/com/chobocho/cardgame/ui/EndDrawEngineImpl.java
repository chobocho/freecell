package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;

import com.chobocho.card.Card;
import com.chobocho.cardgame.BoardProfile;
import com.chobocho.deck.Deck;
import com.chobocho.deck.PlayDeck;
import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class EndDrawEngineImpl implements DrawEngine {
    final static String TAG = "EndDrawEngineImpl";

    int NEW_GAME_IMAGE = 0;
    int CARD_BG_IMAGE = 0;
    int CARD_NONE_IMAGE = 53;
    int CARD_ABG_IMAGE = 54;

    Paint paint = new Paint();

    BoardProfile boardProfile;
    int screenW = 1080;
    int screenH = 1920;

    int width = 120;
    int height = 180;
    int gap = 10;

    public EndDrawEngineImpl(BoardProfile boardProfile) {
        this.boardProfile = boardProfile;
        screenW = boardProfile.screenWidth();
        screenH = boardProfile.screenHeight();
        width = boardProfile.cardWidth();
        height = boardProfile.cardHeight();
        gap = boardProfile.cardGap();
    }

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        onDrawResultDeck(g, cardImages, game);
        g.drawBitmap(buttonImages[NEW_GAME_IMAGE], null, new Rect( (screenW-400)/2, (screenH-200)/2,  (screenW-400)/2+400, (screenH-200)/2+200), paint);
    }

    private void onDrawResultDeck(Canvas g, Bitmap[] cardImages, Freecell game) {
        Deck deck = new PlayDeck();

        for (int i = 0; i < 4; i++) {
            deck = game.getDeck(0);

            if (!deck.isEmpty()) {
                Card card = deck.get(i);
                if (card == null) {
                    continue;
                }
                int imgNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();
                int x1 = gap + width * i + gap * i;
                int y1 = 10;
                g.drawBitmap(cardImages[imgNumber], null, new Rect(x1, y1,  x1+width, y1+height), paint);
            }
        }
    }
}
