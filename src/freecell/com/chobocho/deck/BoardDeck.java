package com.chobocho.deck;

import com.chobocho.card.Card;
import com.chobocho.util.CLog;

import java.util.LinkedList;

public class BoardDeck extends Deck {
    final static String TAG = "BoardDeck";

    public BoardDeck(CardCheckMethod checkMethod) {
        this.deck = new LinkedList<Card>();
        this.checkMethod = checkMethod;
    }

    public void init() {
        this.deck.clear();
    }

    public boolean push(Card card) {
        if (!IsAcceptable(card)) {
            CLog.i(TAG, "Not Acceptable!");
            return false;
        }
        this.deck.push(card);
        return true;
    }

    public Card pop() {
        Card card =  deck.pop();
        if (!deck.isEmpty()) {
            openTopCard();
        }
        return card;
    }

    public boolean openTopCard() {
        return deck.isEmpty() ? false : deck.get(0).open();
    }

    public void openAll() {
        for (int i = 0; i < deck.size(); i++) {
            deck.get(i).open();
        }
    }

    public boolean IsAcceptable(Card newCard) {
        Card card = deck.isEmpty() ? new Card(Card.FIGURE.NONE, Card.NUMBER.NONE) : this.deck.peek();
        return checkMethod.IsAcceptable(card, newCard);
    }
}
