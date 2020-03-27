package com.chobocho.deck;

import com.chobocho.card.Card;

import java.util.Collections;

public class InitDeck extends Deck {

    public InitDeck() {
        super();
        init();
    }

    public void init() {
        this.deck.clear();

        for (Card.FIGURE figure: Card.FIGURE.values()) {
            for(Card.NUMBER number: Card.NUMBER.values()) {
                if ((figure == Card.FIGURE.NONE) ||
                        (number == Card.NUMBER.NONE)) {
                    continue;
                }
                deck.push(new Card(figure, number));
            }
        }
        Collections.shuffle(deck);
    }

    public boolean push(Card card) {
        this.deck.push(card);
        return true;
    }
    public Card pop() {
        return deck.pop();
    }
}
