package com.chobocho.command;

import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.GameObserver;
import game.WinLog;

public abstract class CommandFactory implements GameObserver {
    final static String TAG = "CommandFactory";

    final public static int KEYPRESS_EVENT = 1;
    final public static int MOUSE_CLICK_EVENT = 0;

    protected CommandFactoryState state;
    protected CommandFactoryState idleState;
    protected CommandFactoryState playState;
    protected CommandFactoryState pauseState;
    protected CommandFactoryState endState;
    @Override
    public void updateState(int nextState) {
        WinLog.i(TAG, "updateState: " + nextState);
        switch (nextState) {
            case Freecell.IDLE_STATE:
                state=idleState;
                break;
            case Freecell.PLAY_STATE:
                state=playState;
                break;
            case Freecell.PAUSE_STATE:
                state=pauseState;
                break;
            case Freecell.END_STATE:
                state=endState;
                break;
            default:
                break;
        }
    }

    public PlayCommand CreateCommand(int event, int posX, int posY) {
        return state.createCommand(event, posX, posY);
    }

    public PlayCommand CreateCommand(int fromDeck, int fromPos, int toDeck, int toPos) {
        return state.createCommand(fromDeck, fromPos, toDeck, toPos);
    }
}
