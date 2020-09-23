package com.chobocho.cardgame.cmd;

import com.chobocho.card.Card;
import com.chobocho.cardgame.BoardProfile;
import com.chobocho.command.CardPosition;
import com.chobocho.command.DeckPositoinManager;
import com.chobocho.deck.Deck;
import com.chobocho.freecell.Freecell;

public class DeckPositoinManagerImpl extends DeckPositoinManager {
    final public static String TAG = "DeckPositoinManagerImpl";

    BoardProfile boardProfile;
    int width = 120;
    int height = 180;
    int cardGap = 10;
    int cardGapH = 30;

    public DeckPositoinManagerImpl(BoardProfile boardProfile) {
        super();
        this.boardProfile = boardProfile;
        init();
    }

    private void init() {
        width = boardProfile.cardWidth();
        height = boardProfile.cardHeight();
        cardGap = boardProfile.cardGap();
        cardGapH = boardProfile.cardGapH();

        for (int i = 0; i < 4; i++) {
            CardPosition deck = new CardPosition(Freecell.RESULT_DECK_1 + i, 0, cardGap + (width + cardGap) * i, cardGap, (width + cardGap) * (i + 1), 10 + height);
            addDeckPosition(deck);
        }

        for (int i = 0; i < 4; i++) {
            CardPosition deck = new CardPosition(Freecell.EMPTY_DECK_1 + i, 0, cardGap+(width+cardGap)*(i+4), 10, (width + cardGap) * (i + 5), 10 + height);
            addDeckPosition(deck);
        }

        for (int i = 0; i < 8; i++) {
            CardPosition deck = new CardPosition(Freecell.BOARD_DECK_1 + i, 0, cardGap + (width + cardGap) * i, 40 + height, (width + cardGap) * (i + 1), 40 + height*2);
            addCardPosition(deck);
        }
    }

    @Override
    public void initCardPosition(Freecell game) {
        clearCardPosition();

        if (!game.isPlayState()) {
            return;
        }

        for (int i = 0; i < 8; i++) {
            CardPosition deck = new CardPosition(Freecell.BOARD_DECK_1 + i, 0, cardGap + (width + cardGap) * i, 20 + height, (width + cardGap) * (i + 1), 20 + height*2);
            addCardPosition(deck);
            Deck boardDeck = game.getDeck(Freecell.BOARD_DECK_1+i);
            if (boardDeck == null) {
                continue;
            }
            int cap = 0;
            int startY = 40;
            for (int j = boardDeck.size()-1, k = 0; j >= 0; j--, k++) {
                int deckNumber = Freecell.BOARD_DECK_1 + i;
                Card card = boardDeck.get(j);
                CardPosition pos;
                if (card.isOpen()) {
                    pos = new CardPosition(deckNumber, j, cardGap + (width + cardGap) * i, startY + height + cap, (width + cardGap) * (i + 1), startY + height*2 + cap);
                    cap += cardGapH;
                    addCardPosition(pos);
                } else {
                    pos = new CardPosition(deckNumber, j, cardGap + (width + cardGap) * i, startY + height + cap, (width + cardGap) * (i + 1), startY + height*2 + cap);
                    cap += cardGapH;
                }
            }

        }
    }
}
