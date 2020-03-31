package com.chobocho.deck;

import com.chobocho.card.Card;

public class BoardDeckCheckMethod implements CardCheckMethod {
    @Override
    public boolean IsAcceptable(Card ca, Card cb) {
       if (!cb.isOpen()) {
           return true;
       }

       if (ca.getNumber() == Card.NUMBER.NONE) {
            return true;
        }

       return  (ca.getColor() != cb.getColor()) &&
                ((ca.getNumber().getValue()-1) == cb.getNumber().getValue());
    }
}
