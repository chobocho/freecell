package com.chobocho.deck;

import com.chobocho.card.Card;

public class ResultDeckCheckMethod implements CardCheckMethod {
    @Override
    public boolean IsAcceptable(Card ca, Card cb) {
        if (ca.getNumber() == Card.NUMBER.NONE) {
            return (cb.getNumber() == Card.NUMBER.ACE);
        }

        if (ca.getFigure() != cb.getFigure()) {
            return false;
        }

        return (ca.getNumber().getValue()+1) == cb.getNumber().getValue();
    }
}
