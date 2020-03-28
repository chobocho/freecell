package com.chobocho.command;

public class PlayCommand {
    public static final String UNKNOWN = "known";
    public static final String OPEN = "open";
    public static final String MOVE = "move";
    public static final String PLAY = "play";
    public static final String PAUSE = "pause";
    public static final String IDLE = "idle";
    public static final String WIN = "win";
    public static final String BACK = "back";

    public String command;
    public int from;
    public int to;
    public int count;

    public PlayCommand(String cmd, int from, int to) {
        this.command = cmd;
        this.from = from;
        this.to = to;
        this.count = 1;
    }

    public PlayCommand(String cmd, int from, int to, int count) {
        this.command = cmd;
        this.from = from;
        this.to = to;
        this.count = count;
    }

    public String toString() {
        return command + ":" + from + "->" + to + " C " + count;
    }

}
