package game.cmd;

import com.chobocho.command.*;
import game.WinLog;

public class WinPauseCommandFactoryStateImpl extends PauseCommandFactoryStateImpl implements CommandFactoryState {
    final static String TAG = "WinPauseCommandFactoryStateImpl";
    int screenW = 910;

    @Override
    public PlayCommand createCommand(int event, int x, int y) {
        WinLog.i(TAG, "Event:" + Integer.toString(event));
        if (event == CommandFactory.KEYPRESS_EVENT) {
            switch(x) {
                case 82: // R
                case 83: // S
                    return new PlayCommand(PlayCommand.PLAY, 0, 0);
            }
        }
        else if (event == CommandFactory.MOUSE_CLICK_EVENT) {
            for (ButtonPosition btn: buttons) {
                if (btn.isInRange(x, y)) {
                    return new PlayCommand(btn.id, 0, 0);
                }
            }
        }
        return null;
    }

    @Override
    public PlayCommand createCommand(int fromDeck, int fromPos, int toDeck, int toPos) {
        WinLog.i(TAG, "PauseState");
        return null;
    }

    @Override
    public void addButtons() {
        WinLog.i(TAG, "addButtons");
        buttons.push(new ButtonPosition(PlayCommand.PLAY, (screenW-200)/2, 250, 300+200,250+100));
        buttons.push(new ButtonPosition(PlayCommand.IDLE, (screenW-200)/2, 450, 300+200,450+100));
    }
}
