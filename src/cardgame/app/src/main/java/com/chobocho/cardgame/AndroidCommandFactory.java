package com.chobocho.cardgame;

import com.chobocho.cardgame.cmd.WinEndCommandFactoryStateImpl;
import com.chobocho.cardgame.cmd.WinIdleCommandFactoryStateImpl;
import com.chobocho.cardgame.cmd.WinPauseCommandFactoryStateImpl;
import com.chobocho.cardgame.cmd.WinPlayCommandFactoryStateImpl;
import com.chobocho.command.CommandFactory;

public class AndroidCommandFactory extends CommandFactory {

    public AndroidCommandFactory(BoardProfile boardProfile) {
        idleState = new WinIdleCommandFactoryStateImpl(boardProfile);
        playState = new WinPlayCommandFactoryStateImpl(boardProfile);
        pauseState = new WinPauseCommandFactoryStateImpl(boardProfile);
        endState = new WinEndCommandFactoryStateImpl(boardProfile);
    }

}
