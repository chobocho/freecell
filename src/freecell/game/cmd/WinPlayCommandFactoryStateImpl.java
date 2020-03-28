package game.cmd;

import com.chobocho.command.*;
import com.chobocho.freecell.Freecell;
import game.WinLog;

import java.awt.event.KeyEvent;

public class WinPlayCommandFactoryStateImpl extends PlayCommandFactoryStateImpl implements CommandFactoryState {
    final static String TAG = "WinPlayCommandFactoryStateImpl";
    int width = 100;
    int heigth = 150;

    @Override
    public PlayCommand createCommand(int fromDeck, int fromPos, int toDeck, int toPos) {
        if (fromDeck == toDeck) {
            //return new PlayCommand(PlayCommand.OPEN, fromDeck, fromDeck);
            return null;
        }
        else {
            int count = fromPos+1;
            return new PlayCommand(PlayCommand.MOVE, fromDeck, toDeck, count);
        }
    }

    @Override
    public PlayCommand createCommand(int event, int x, int y) {
        WinLog.i(TAG, "Event:" + Integer.toString(event));
        if (event == CommandFactory.KEYPRESS_EVENT) {
            switch(x) {
                case 49: // 1
                case 50: // 2
                case 51: // 3
                case 52: // 4
                case 53: // 5
                case 54: // 6
                case 55: // 7
                case 56: // 8
                    return new PlayCommand(PlayCommand.MOVE, x - 49 + Freecell.BOARD_DECK_1, y);

                case 57:
                    return new PlayCommand(PlayCommand.MOVE, Freecell.EMPTY_DECK_1, y);
                case 48:
                    return new PlayCommand(PlayCommand.MOVE, Freecell.EMPTY_DECK_2, y);
                case 45: // -
                    return new PlayCommand(PlayCommand.MOVE, Freecell.EMPTY_DECK_3, y);
                case 61 : // =
                    return new PlayCommand(PlayCommand.MOVE, Freecell.EMPTY_DECK_4, y);

                case 81: // Q
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_1, y);
                case 87: // W
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_2, y);
                case 69: // E
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_3, y);
                case 82: // R
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_4, y);
                case 84: // T
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_5, y);
                case 89: // Y
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_6, y);
                case 85: // U
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_7, y);
                case 73: // I
                    return new PlayCommand(PlayCommand.MOVE, Freecell.BOARD_DECK_8, y);

                case 66: // B
                    return new PlayCommand(PlayCommand.BACK, 0, 0);

                case 27: // ESC
                case 80: // P
                    return new PlayCommand(PlayCommand.PAUSE, 0, 0);
            }
        } else if (event == CommandFactory.MOUSE_CLICK_EVENT) {

        } else {
            WinLog.i(TAG, "Unknown Event:" + Integer.toString(x) + " : " + Integer.toString(y));
        }
        return null;
    }
	
	@Override
    public void addButtons() {
        WinLog.i(TAG, "addButtons");
    }
}
