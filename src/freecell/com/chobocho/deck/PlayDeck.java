package com.chobocho.deck;

import com.chobocho.card.Card;

public class PlayDeck extends Deck {
    final static String TAG = "PlayDeck";

    public PlayDeck() {

    }

    public void init() {
        this.deck.clear();
    }

    public boolean push(Card card) {
        this.deck.push(card);
        return true;
    }

    public Card pop() {
        return deck.pop();
    }

    public boolean openTopCard() {
        return (!deck.isEmpty()) && deck.get(0).open();
    }

    public void openAll() {
        for (Card card : deck) {
            card.open();
        }
    }
}
