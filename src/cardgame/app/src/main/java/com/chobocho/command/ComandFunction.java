package com.chobocho.command;

import com.chobocho.freecell.Freecell;

public interface ComandFunction {
    public boolean run(Freecell game, int from, int to, int count);
}
