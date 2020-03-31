package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;

import com.chobocho.card.Card;
import com.chobocho.deck.Deck;
import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class PlayDrawEngineImpl implements DrawEngine {
    final static String TAG = "PlayDrawEngineImpl";
    final static int CARD_NONE_IMAGE = 53;
    int width = 100;
    int height = 150;
    int cardCap = 20;

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

        for (int i = 0; i < 8; i++) {
            decks[i] = game.getDeck(Freecell.BOARD_DECK_1+i);

            int cap = 0;
            for (int j = decks[i].size()-1, k = 0; j >= 0; --j, k++) {
                Card card = decks[i].get(j);
                if (card.isOpen()) {
                    int imgNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();

                    if (!hideCard.contains(imgNumber)) {
                        //g.drawImage(cardImages[imgNumber], 10 + width * i + 10 * i, 20 + height + cap, null);
                    }
                    cap += cardCap*2;
                } else {
                    //g.drawImage(cardImages[0], 10 + width * i + 10 * i, 20 + height + cap, null);
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
                if (!hideCard.contains(imgNumber)) {
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
                if (!hideCard.contains(imgNumber)) {
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
