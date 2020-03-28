package com.chobocho.command;

import com.chobocho.freecell.Freecell;
import com.chobocho.util.CLog;

import java.util.HashMap;

public class CommandEngine {
    final static String TAG = "CommandEngine";
    Freecell game;
    HashMap<String, ComandFunction> functionMap;

    public CommandEngine(Freecell freecell) {
        this.game = freecell;
        this.functionMap = new HashMap<String, ComandFunction>();
        initFunction();
    }

    private void initFunction() {
        functionMap.put(PlayCommand.MOVE, new MoveFunction());
        functionMap.put(PlayCommand.OPEN, new OpenFunction());
        functionMap.put(PlayCommand.PLAY, new PlayFunction());
        functionMap.put(PlayCommand.PAUSE, new PauseFunction());
        functionMap.put(PlayCommand.IDLE, new IdleFunction());
        functionMap.put(PlayCommand.WIN, new WinFunction());
        functionMap.put(PlayCommand.BACK, new BackFunction());
    }

    public boolean runCommand (PlayCommand command) {
        if (command == null) {
            CLog.i(TAG, "Command is null");
            return false;
        }
        CLog.i(TAG, command.toString());
        boolean result = functionMap.get(command.command).run(this.game, command.from, command.to, command.count);
        if (game.isFinishGame()) {
            return functionMap.get(PlayCommand.WIN).run(this.game, 0, 0, 0);
        }
        return result;
    }
}
