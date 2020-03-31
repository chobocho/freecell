package com.chobocho.command;

import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class DeckPositoinManager {
    protected  LinkedList<CardPosition> deckList;
    protected  LinkedList<CardPosition> boardCards;

    public DeckPositoinManager() {
        deckList = new LinkedList<CardPosition>();
        boardCards = new LinkedList<CardPosition>();
    }

    public void addDeckPosition(CardPosition deck) {
        deckList.push(deck);
    }

    public void addCardPosition(CardPosition deck) {
        boardCards.push(deck);
    }

    public CardPosition getCardInfo(int x, int y) {
        CardPosition card = getDeckInfo(x, y);
        if (card == null) {
            card = getBoardCardInfo(x, y);
        }
        return card;
    }

    protected CardPosition getDeckInfo(int x, int y) {
        for (CardPosition card : deckList) {
            if (card.isInRange(x, y)) {
                return card;
            }
        }
        return null;
    }

    protected CardPosition getBoardCardInfo(int x, int y) {
        for (CardPosition card : boardCards) {
            if (card.isInRange(x, y)) {
                return card;
            }
        }
        return null;
    }

    public void initCardPosition(Freecell game) {

    }

    public void clearCardPosition() {
        boardCards.clear();
    }

    public String toString() {
        StringBuffer result = new StringBuffer();

        for(int i = 0; i < deckList.size(); i++) {
            result.append(deckList.get(i).toString() + "\n");
        }

        for(int i = 0; i < boardCards.size(); i++) {
            result.append(boardCards.get(i).toString() + "\n");
        }
        return result.toString();
    }
}
