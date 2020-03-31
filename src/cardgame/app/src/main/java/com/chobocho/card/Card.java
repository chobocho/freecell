package com.chobocho.card;

public class Card {
    public static enum COLOR {
        RED(0),
        BLACK(1);

        int color;
        COLOR(int c) { color = c;}
        public int getValue() { return color; }
    }

    public static enum FIGURE {
        NONE(0),
        CLOVER(1),
        DIAMOND(2),
        HEART(3),
        SPADE(4);

        int figure;
        FIGURE(int f) {
            figure = f;
        }
        public int getValue() {
            return figure;
        }
    }

    public static enum NUMBER {
        NONE(0),
        ACE(1),
        TWO(2),
        THREE(3),
        FOUR(4),
        FIVE(5),
        SIX(6),
        SEVEN(7),
        EIGHT(8),
        NIEN(9),
        TEN(10),
        JACK(11),
        QUEEN(12),
        KING(13);

        int number;
        NUMBER(int n) {
            number = n;
        }
        public int getValue() {
            return number;
        }
    }

    public Card(FIGURE type, NUMBER number) {
        this.figure = type;
        this.number = number;
        setColor();
    }

    public Card(int card) {
        figure = FIGURE.values()[card >> 5];
        number = NUMBER.values()[(card >> 1)& 0xf];
        isOpenState = ((card & 0x1) == 0x1);
    }

    private void setColor() {
        if ((this.figure == FIGURE.SPADE)||(this.figure == FIGURE.CLOVER)) {
            this.color = COLOR.BLACK;
        } else {
            this.color = COLOR.RED;
        }
    }

    private boolean isOpenState;
    private COLOR color;
    private NUMBER number;
    private FIGURE figure;

    public boolean open() {
       isOpenState = true;
       return true;
    }

    public boolean close() {
        isOpenState = false;
        return true;
    }

    public boolean isOpen() {
        return isOpenState;
    }

    public NUMBER getNumber() {
        return number;
    }

    public COLOR  getColor() {
        return color;
    }

    public FIGURE getFigure() {
        return figure;
    }

    public String toString() {
        String[] figureName = { "N", "C", "D", "H", "S"};
        String[] NumberName = { "N", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"};
        String openState = this.isOpenState ? "O" : "C";

        return figureName[this.figure.getValue()] + NumberName[this.number.getValue()] + "_" + openState;
    }

    public int toInt() {
        // FIGURE 2 bit | NU<BER 4 bit | OPEN 1 bit
        return figure.getValue() << 5 | number.getValue() << 1 | (isOpenState ? 1 : 0);
    }
}