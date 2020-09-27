package com.chobocho.command;

import com.chobocho.cardgame.BoardProfile;

import java.util.LinkedList;

public class PlayCommandFactoryStateImpl implements CommandFactoryState {
    protected LinkedList<ButtonPosition> buttons = new LinkedList<ButtonPosition>();

    protected BoardProfile boardProfile;
    protected int screenW;
    protected int screenH;
    protected int width;
    protected int height;
    protected int cardGap;
    protected int cardGapH;

    public PlayCommandFactoryStateImpl(BoardProfile boardProfile) {
        screenW = boardProfile.screenWidth();
        screenH = boardProfile.screenHeight();
        width = boardProfile.cardWidth();
        height = boardProfile.cardHeight();
        cardGap = boardProfile.cardGap();
        cardGapH = boardProfile.cardGapH();
        addButtons();
    }

    @Override
    public PlayCommand createCommand(int event, int x, int y) {
        return null;
    }

    @Override
    public PlayCommand createCommand(int fromDeck, int fromPos, int toDeck, int toPos) {
        return null;
    }

    public void addButtons() {

    }
}
