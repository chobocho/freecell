package com.chobocho.freecell;

public class MoveCommand {
    public int from;
    public int to;
    public int count;

    public MoveCommand() {

    }

    public MoveCommand(int from, int to, int count) {
        this.from = from;
        this.to = to;
        this.count = count;
    }

    public String toString() {
        return "F: " + from + " T:" + to + " C:" + count;
    }
}
