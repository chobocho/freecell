package com.chobocho.command;

import com.chobocho.freecell.Freecell;

import java.util.LinkedList;

public class DeckPositionManager {
    protected  LinkedList<CardPosition> deckList;
    protected  LinkedList<CardPosition> boardCards;

    public DeckPositionManager() {
        deckList = new LinkedList<>();
        boardCards = new LinkedList<>();
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
        StringBuilder result = new StringBuilder();

        for (CardPosition cardPosition : deckList) {
            result.append(cardPosition.toString() + "\n");
        }

        for (CardPosition boardCard : boardCards) {
            result.append(boardCard.toString() + "\n");
        }
        return result.toString();
    }
}
