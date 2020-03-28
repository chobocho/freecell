package com.chobocho.freecell;


import com.chobocho.card.Card;
import com.chobocho.deck.Deck;
import com.chobocho.util.CLog;

import java.util.ArrayList;

public class FreecellImpl implements Freecell {
    private static final String TAG = "SolitareImpl";
    private static final String Version = "0.1105.TC2";
    GameState state;
    IdleState idleState;
    PlayState playState;
    PauseState pauseState;
    EndState endState;
    ArrayList<GameObserver> observers = new ArrayList<>();
    CLog log;

    public FreecellImpl(CLog log) {
        this.log = log;
        idleState = new IdleState();
        playState = new PlayState();
        pauseState = new PauseState();
        endState = new EndState();

        setState(PlayState.IDLE_STATE);
    }

    public void register(GameObserver observer) {
        this.observers.add(observer);
        observer.updateState(state.getState());
    }

    @Override
    public boolean isMovableDeck(int deck) {
        if (deck < Freecell.RESULT_DECK_1 || deck > Freecell.RESULT_DECK_4) {
            return true;
        }
        return false;
    }

    public void notifyToOberver() {
        for (GameObserver observer: observers) {
            observer.updateState(state.getState());
        }
    }

    public Deck getDeck(int deck) {
        return state.getDeck(deck);
    }

    public boolean moveCard(int from, int to, int count) {
        CLog.i(TAG,"Try to move card from " + from + " to " + to + " count " + count);
        return state.moveCard(from, to, count);
    }

    public boolean play() {
        return setState(GameState.PLAY_STATE);
    }

    public boolean pause() {
        return setState(GameState.PAUSE_STATE);
    }

    public boolean winState() {
        return setState(GameState.END_STATE);
    }
    public boolean idle() {
        return setState(GameState.IDLE_STATE);
    }

    public boolean openDeck(int deck) {
        CLog.i(TAG,"openDeck: " + deck);
        return state.openCard(deck);
    }

    private boolean setState(int newState) {
        switch (newState) {
            case GameState.IDLE_STATE:
                playState.initGame();
                state = idleState;
                break;
            case GameState.PLAY_STATE:
                state = playState;
                break;
            case GameState.PAUSE_STATE:
                state = pauseState;
                break;
            case GameState.END_STATE:
                Card[] cards = new Card[4];
                cards[0] = playState.getDeck(Freecell.RESULT_DECK_1).top();
                cards[1] = playState.getDeck(Freecell.RESULT_DECK_2).top();
                cards[2] = playState.getDeck(Freecell.RESULT_DECK_3).top();
                cards[3] = playState.getDeck(Freecell.RESULT_DECK_4).top();
                playState.initGame();
                state = endState;
                state.pushCard(cards);
                break;
            default:
                break;
        }
        notifyToOberver();
        return true;
    }

    public boolean isPlayState() {
        return state.isPlayState();
    }

    public boolean isFinishGame() {
        return state.isFinishGame();
    }
}