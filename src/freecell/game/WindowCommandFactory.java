package game;

import com.chobocho.command.CommandFactory;
import game.cmd.*;

public class WindowCommandFactory extends CommandFactory {

    public WindowCommandFactory() {
        idleState = new WinIdleCommandFactoryStateImpl();
        playState = new WinPlayCommandFactoryStateImpl();
        pauseState = new WinPauseCommandFactoryStateImpl();
        endState = new WinEndCommandFactoryStateImpl();
    }

}
