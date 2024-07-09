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

    public void clear() {
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

    public Card top() {
        return deck.peek();
    }

    public Card get(int n) {
        if(deck.isEmpty()) {
            return null;
        }
        return deck.get(n);
    }

    public boolean openTopCard() {
        if (deck.isEmpty()) {
            return false;
        }
        return deck.get(0).open();
    }

    public void openAll() {
        for (int i = 0; i < deck.size(); i++) {
            deck.get(i).open();
        }
    }

    public boolean IsAcceptable(Card newCard) {
        Card card = null;
        if (!deck.isEmpty()) {
            card = this.deck.peek();
        } else {
            card = new Card(Card.FIGURE.NONE, Card.NUMBER.NONE);
        }
        return checkMethod.IsAcceptable(card, newCard);
    }

    public void setCheckMethod(CardCheckMethod method) {
        this.checkMethod = checkMethod;
    }

    public String toString() {
        StringBuffer result = new StringBuffer();

        for(Card card : deck) {
            result.append(card + " ");
        }

        return result.toString();
    }

    public int size() {
        return this.deck.size();
    }
}
