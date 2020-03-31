package com.chobocho.cardgame;

import com.chobocho.cardgame.cmd.WinEndCommandFactoryStateImpl;
import com.chobocho.cardgame.cmd.WinIdleCommandFactoryStateImpl;
import com.chobocho.cardgame.cmd.WinPauseCommandFactoryStateImpl;
import com.chobocho.cardgame.cmd.WinPlayCommandFactoryStateImpl;
import com.chobocho.command.CommandFactory;

public class AndroidCommandFactory extends CommandFactory {

    public AndroidCommandFactory() {
        idleState = new WinIdleCommandFactoryStateImpl();
        playState = new WinPlayCommandFactoryStateImpl();
        pauseState = new WinPauseCommandFactoryStateImpl();
        endState = new WinEndCommandFactoryStateImpl();
    }

}
