package game.cmd;

import com.chobocho.command.*;
import game.WinLog;

public class WinIdleCommandFactoryStateImpl extends IdleCommandFactoryStateImpl implements CommandFactoryState {
    final static String TAG = "WinIdleCommandFactoryStateImpl";

    @Override
    public PlayCommand createCommand(int event, int x, int y) {
        WinLog.i(TAG, "Event:" + Integer.toString(event));
        if (event == CommandFactory.KEYPRESS_EVENT) {
            switch(x) {
                case 79: // O
                case 83: // S
                    return new PlayCommand(PlayCommand.PLAY, 0, 0);
            }
        }
        else if (event == CommandFactory.MOUSE_CLICK_EVENT) {
            for (ButtonPosition btn: buttons) {
                if (btn.isInRange(x, y)) {
                    if (btn.id.equals(PlayCommand.PLAY)) {
                        return new PlayCommand(btn.id, 0, 0);
                    }
                }
            }
        }
        return null;
    }

    @Override
    public PlayCommand createCommand(int fromDeck, int fromPos, int toDeck, int toPos) {
        WinLog.i(TAG, "IdleState");
        return null;
    }

    @Override
    public void addButtons() {
        int screenW = 910;
        WinLog.i(TAG, "addButtons");
        buttons.push(new ButtonPosition(PlayCommand.PLAY, (screenW-200)/2, 300, (screenW-200)/2+200,300+100));
        WinLog.i(TAG,buttons.toString());
    }
}
