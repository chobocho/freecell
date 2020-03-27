package com.chobocho.deck;

import com.chobocho.card.Card;

public class EmptyDeckCheckMethod implements CardCheckMethod {
    @Override
    public boolean IsAcceptable(Card ca, Card cb) {
        if (ca.getNumber() == Card.NUMBER.NONE) {
            return true;
        }
        return false;
    }
}
