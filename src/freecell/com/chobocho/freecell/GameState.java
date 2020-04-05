package com.chobocho.freecell;

import com.chobocho.card.Card;
import com.chobocho.deck.Deck;

public class GameState {


    public Deck getDeck(int deck) {
        return null;
    }

    public boolean isIdleState() {
        return false;
    }

    public boolean isPlayState() {
        return false;
    }

    public boolean isPauseState() {
        return false;
    }

    public boolean moveCard(int from, int to, int count) {
        return false;
    }

    public int getState() {
        return Freecell.NONE_STATE;
    }

    public boolean openCard(int deck) {
        return false;
    }

    public boolean revert() {
        return false;
    }

    public void pushCard(Card[] cards) {
    }

    public boolean isFinishGame() {
        return false;
    }

    public int getMoveCount() {
        return 0;
    }
}