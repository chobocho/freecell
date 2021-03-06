package com.chobocho.cardgame.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.widget.HeaderViewListAdapter;

import com.chobocho.card.Card;
import com.chobocho.cardgame.BoardProfile;
import com.chobocho.deck.Deck;
import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class PlayDrawEngineImpl implements DrawEngine {
    final static String TAG = "PlayDrawEngineImpl";

    int CARD_BG_IMAGE = 0;
    int PAUSE_BUTTON = 3;
    int REVERT_BUTTON = 4;

    Paint paint = new Paint();

    BoardProfile boardProfile;
    int screenW = 1080;
    int screenH = 1920;

    int width = 120;
    int height = 180;
    int cardCap = 10;
    int cardCapH = 20;

    public PlayDrawEngineImpl(BoardProfile boardProfile) {
        this.boardProfile = boardProfile;
        screenW = boardProfile.screenWidth();
        screenH = boardProfile.screenHeight();
        width = boardProfile.cardWidth();
        height = boardProfile.cardHeight();
        cardCap = boardProfile.cardGap();
        cardCapH = boardProfile.cardGapH();
    }

    @Override
    public void onDraw(Canvas g, Freecell game, LinkedList<Integer> hideCard, Bitmap[] cardImages, Bitmap[] buttonImages) {
        onDrawBoardDeck(g, cardImages, game, hideCard);
        onDrawResultDeck(g, cardImages, game, hideCard);
        onDrawEmptyDeck(g, cardImages, game, hideCard);

        int x1 = (width + cardCap) * 4;
        int y1 = screenH - (height + cardCapH);
        int buttonWidth = (int)(width * 1.5);
        g.drawBitmap(buttonImages[REVERT_BUTTON], null, new Rect(x1, y1,  x1+buttonWidth, y1+buttonWidth), paint);

        int x2 = (width + cardCap) * 6;
        int y2 = screenH - (height + cardCapH);
        g.drawBitmap(buttonImages[PAUSE_BUTTON], null, new Rect(x2, y2, x2 + buttonWidth, y2 + buttonWidth), paint);

        paint.setTextSize(cardCapH);
        paint.setColor(Color.BLUE);
        g.drawText("Move: " + Integer.toString(game.getMoveCount()), cardCap, screenH - width, paint);
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

                    if (hideCard == null || !hideCard.contains(imgNumber)) {
                        int x1 = cardCap + width * i + cardCap * i;
                        int y1 = 40 + height + cap;
                        g.drawBitmap(cardImages[imgNumber], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                    }
                    cap += cardCapH;
                } else {
                    int x1 = cardCap + width * i + cardCap * i;
                    int y1 = 40 + height + cap;
                    g.drawBitmap(cardImages[CARD_BG_IMAGE], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                    cap += cardCapH;
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
                    int x1 = cardCap + width * i + cardCap * i;
                    int y1 =  10;
                    g.drawBitmap(cardImages[imgNumber], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                } else {
                    if (decks[i].size() > 1 ) {
                        Card preCard = decks[i].get(1);
                        int preImgNumber = (preCard.getFigure().getValue() - 1) * 13 + preCard.getNumber().getValue();
                        int x1 = cardCap + width * i + cardCap * i;
                        int y1 =  10;
                        g.drawBitmap(cardImages[preImgNumber], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                    }
                }
            }
        }
    }

    private void onDrawEmptyDeck(Canvas g, Bitmap[] cardImages, Freecell game, LinkedList<Integer> hideCard) {
        //WinLog.i(TAG, "onDrawResultDeck");
        Deck[] decks = new Deck[4];
        int startPos = (width+cardCap)*4;

        for (int i = 0; i < 4; i++) {
            decks[i] = game.getDeck(Freecell.EMPTY_DECK_1+i);

            if (!decks[i].isEmpty()) {
                Card card = decks[i].top();
                //WinLog.i(TAG, decks[i].toString());
                //WinLog.i(TAG, card.toString());
                int imgNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();
                if (hideCard == null || !hideCard.contains(imgNumber)) {
                    int x1 = startPos + cardCap + width * i + cardCap * i;
                    int y1 = 10;
                    g.drawBitmap(cardImages[imgNumber], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                } else {
                    if (decks[i].size() > 1 ) {
                        Card preCard = decks[i].get(1);
                        int preImgNumber = (preCard.getFigure().getValue() - 1) * 13 + preCard.getNumber().getValue();
                        int x1 = startPos + cardCap + width * i + cardCap * i;
                        int y1 = 10;
                        g.drawBitmap(cardImages[preImgNumber], null, new Rect(x1, y1,  x1+width, y1+height), paint);
                    }
                }
            }
        }
    }

}
