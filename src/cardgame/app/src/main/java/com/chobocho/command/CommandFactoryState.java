package com.chobocho.command;

public interface CommandFactoryState {
    public PlayCommand createCommand(int event, int x, int y);
    public PlayCommand createCommand(int fromDeck, int fromPos, int toDeck, int toPos);
}
