package com.chobocho.command;

import com.chobocho.freecell.Freecell;

public class PauseFunction implements CommandFunction {
    @Override
    public boolean run(Freecell game, int from, int to, int count) {
        return game.pause();
    }
}
