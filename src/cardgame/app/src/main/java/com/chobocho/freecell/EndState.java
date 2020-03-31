package com.chobocho.freecell;

import com.chobocho.card.Card;
import com.chobocho.deck.Deck;
import com.chobocho.deck.InitDeck;

public class EndState extends GameState {
    Deck resultDeck;

    public EndState() {
        resultDeck = new InitDeck();
    }

    public int getState() { return END_STATE; }

    public void pushCard(Card[] cards) {
        resultDeck.clear();
        for (int i = cards.length-1; i >=0 ; --i) {
            resultDeck.push(cards[i]);
        }
    }

    public Deck getDeck(int deck) {
        return resultDeck;
    }
}