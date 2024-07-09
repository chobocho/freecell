package com.chobocho.deck;

import com.chobocho.card.Card;

import java.util.LinkedList;

abstract public class Deck {
    protected CardCheckMethod checkMethod;
    protected LinkedList<Card> deck;

    public Deck() {
        this.deck = new LinkedList<Card>();
    }

    public void setCheckMethod(CardCheckMethod method) {
        this.checkMethod = method;
    }

    abstract public boolean push(Card card);

    abstract public Card pop();

    public Card top() {
        return deck.peek();
    }

    public boolean openTopCard() {
        return false;
    }

    public Card get(int n) {
        return (deck.isEmpty()) ? null : deck.get(n);
    }

    public void clear() {
        this.deck.clear();
    }

    abstract public void init();
    public void openAll() {
    }

    public int size() {
        return this.deck.size();
    }
    public boolean isEmpty() {
        return this.deck.isEmpty();
    }

    public String toString() {
        StringBuffer result = new StringBuffer();

        for (Card card : deck) {
            result.append(card + " ");
        }

        return result.toString();
    }
}