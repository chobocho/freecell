package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;

import com.chobocho.card.Card;
import com.chobocho.deck.Deck;
import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class PlayDrawEngineImpl implements DrawEngine {
    final static String TAG = "PlayDrawEngineImpl";
    int screenW = 1080;
    int screenH = 1920;

    int CARD_BG_IMAGE = 0;
    int CARD_NONE_IMAGE = 53;
    int CARD_ABG_IMAGE = 54;

    int width = 120;
    int height = 180;
    int cardCap = 30;
    public PlayDrawEngineImpl() {

    }

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        onDrawBoardDeck(g, cardImages, game, hideCard);
        onDrawResultDeck(g, cardImages, game, hideCard);
        onDrawEmptyDeck(g, cardImages, game, hideCard);
    }

    private void onDrawBoardDeck(Canvas g, Bitmap[] cardImages, Freecell game, LinkedList<Integer> hideCard) {
        Deck[] decks = new Deck[8];
        Paint paint = new Paint();

        for (int i = 0; i < 8; i++) {
            decks[i] = game.getDeck(Freecell.BOARD_DECK_1+i);

            int cap = 0;
            for (int j = decks[i].size()-1, k = 0; j >= 0; --j, k++) {
                Card card = decks[i].get(j);
                if (card.isOpen()) {
                    int imgNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();

                    if (hideCard == null || !hideCard.contains(imgNumber)) {
                        //g.drawImage(cardImages[imgNumber], 10 + width * i + 10 * i, 20 + height + cap, null);
                        int x1 = 10 + width * i + 10 * i;
                        int y1 =  40 + height + cap;
                        g.drawBitmap(cardImages[imgNumber], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                    }
                    cap += cardCap*2;
                } else {
                    int x1 = 10 + width * i + 10 * i;
                    int y1 =  40 + height + cap;
                    g.drawBitmap(cardImages[CARD_BG_IMAGE], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                    cap += cardCap;
                }
            }
        }
    }

    private void onDrawResultDeck(Canvas g, Bitmap[] cardImages, Freecell game, LinkedList<Integer> hideCard) {
        //WinLog.i(TAG, "onDrawResultDeck");
        Deck[] decks = new Deck[4];

        for (int i = 0; i < 4; i++) {
            decks[i] = game.getDeck(Freecell.RESULT_DECK_1+i);

            if (!decks[i].isEmpty()) {
                Card card = decks[i].top();
                //WinLog.i(TAG, decks[i].toString());
                //WinLog.i(TAG, card.toString());
                int imgNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();
                if (hideCard == null || !hideCard.contains(imgNumber)) {
                    //g.drawImage(cardImages[imgNumber], 10 + width * i + 10 * i, 10, null);
                } else {
                    if (decks[i].size() > 1 ) {
                        Card preCard = decks[i].get(1);
                        int preImgNumber = (preCard.getFigure().getValue() - 1) * 13 + preCard.getNumber().getValue();
                       //g.drawImage(cardImages[preImgNumber], 10 + width * i + 10 * i, 10, null);
                    }
                }
            }
        }
    }

    private void onDrawEmptyDeck(Canvas g, Bitmap[] cardImages, Freecell game, LinkedList<Integer> hideCard) {
        //WinLog.i(TAG, "onDrawResultDeck");
        Deck[] decks = new Deck[4];
        int startPos = (width+10)*4;

        for (int i = 0; i < 4; i++) {
            decks[i] = game.getDeck(Freecell.EMPTY_DECK_1+i);

            if (!decks[i].isEmpty()) {
                Card card = decks[i].top();
                //WinLog.i(TAG, decks[i].toString());
                //WinLog.i(TAG, card.toString());
                int imgNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();
                if (hideCard == null || !hideCard.contains(imgNumber)) {
                  //  g.drawImage(cardImages[imgNumber], startPos + 10 + width * i + 10 * i, 10, null);
                } else {
                    if (decks[i].size() > 1 ) {
                        Card preCard = decks[i].get(1);
                        int preImgNumber = (preCard.getFigure().getValue() - 1) * 13 + preCard.getNumber().getValue();
                   //    g.drawImage(cardImages[preImgNumber], startPos + 10 + width * i + 10 * i, 10, null);
                    }
                }
            }
        }
    }

}
