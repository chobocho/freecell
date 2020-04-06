package com.chobocho.freecell;

import com.chobocho.deck.Deck;

/**
 * 
 */
public interface Freecell {
    String Version = "0.1105.TD2";
    int NONE_STATE = -1;
    int IDLE_STATE = 0;
    int PLAY_STATE = 1;
    int PAUSE_STATE = 2;
    int END_STATE = 3;

    int INIT_DECK = 0;
    int RESULT_DECK_1 = 1;
    int RESULT_DECK_2 = 2;
    int RESULT_DECK_3 = 3;
    int RESULT_DECK_4 = 4;
    int EMPTY_DECK_1 = 5;
    int EMPTY_DECK_2 = 6;
    int EMPTY_DECK_3 = 7;
    int EMPTY_DECK_4 = 8;
    int BOARD_DECK_1 = 9;
    int BOARD_DECK_2 = 10;
    int BOARD_DECK_3 = 11;
    int BOARD_DECK_4 = 12;
    int BOARD_DECK_5 = 13;
    int BOARD_DECK_6 = 14;
    int BOARD_DECK_7 = 15;
    int BOARD_DECK_8 = 16;

    public Deck getDeck(int deck);
    public boolean moveCard(int from, int to, int count);
    public boolean openDeck(int deck);
    public boolean play();
    public boolean pause();
    public boolean winState();
    public boolean idle();
    public void register(GameObserver observer);

    public boolean revert();
    public boolean isMovableDeck(int deck);
    public boolean isPlayState();
    public boolean isFinishGame();

    public int getMoveCount();
}