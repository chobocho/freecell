package game;

import com.chobocho.card.Card;
import com.chobocho.command.*;
import com.chobocho.freecell.Freecell;
import game.cmd.DeckPositionManagerImpl;
import game.ui.*;

import java.awt.*;
import java.awt.event.*;
import java.util.LinkedList;

import javax.swing.JLabel;
import javax.swing.JPanel;

public class CardGameGui extends JPanel{
    static final String TAG = "CardGameGui";
    JLabel statusbar;

    private Image screenBuffer = null;
    private Graphics graphicsBuffer = null;

    private Freecell freecell;
    private DrawEngineManager drawEngineManager;
    private CommandEngine cmdEngine;
    private CommandFactory commandFactory;
    private DeckPositionManager deckPositionManager;


    public final static int CARD_BG_IMAGE = 0;
    public final static int CARD_NONE_IMAGE = 53;
    private CardGameMouseAdapter cardGameMouseAdapter;

    final public static int NEW_GAME_IMAGE = 0;
    final public static int PLAY_GAME_IMAGE = 1;
    final public static int RESUME_GAME_IMAGE = 2;

    public CardGameGui(CardGameMain parent, Freecell freecell, BoardProfile boardProfile, CommandEngine cmdEngine) {
        this.freecell = freecell;
        this.cmdEngine = cmdEngine;
        drawEngineManager = new DrawEngineManagerImpl(freecell, boardProfile, this);
        this.deckPositionManager = new DeckPositionManagerImpl();
        commandFactory = new WindowCommandFactory();
        this.freecell.register(commandFactory);

        statusbar = parent.getStatusBar();
        setFocusable(true);
        addKeyListener(new CardGameKeyAdapter());
        cardGameMouseAdapter = new CardGameMouseAdapter();
        addMouseListener(cardGameMouseAdapter);
        addMouseMotionListener(new CardGameMouseMoveAdapter());
    }


    public void update() {
        repaint();
    }

    public void updateStatusBar(int state) {
        if (statusbar == null) {
            return;
        }
        switch (state) {
            case Freecell.IDLE_STATE:
                statusbar.setText(" Press S to start game!");
                break;
            case Freecell.PLAY_STATE:
                statusbar.setText(" [Help] ESC or P:  pause game | B:  Revert | " + freecell.getMoveCount() + " moved");
                break;
            case Freecell.PAUSE_STATE:
                statusbar.setText(" Press S or R to resume game!");
                break;
            case Freecell.END_STATE:
                statusbar.setText(" Press S to start game!");
                break;
            default:
                break;
        }
    }

    private void updateMoveCount() {
        if (freecell.isPlayState()) {
            statusbar.setText(" [Help] ESC or P:  pause game | B:  Revert | " + freecell.getMoveCount() + " moved");
        }
    }

    public void start() {
        statusbar.setText("Press S to start game!");
    }

    public void paint(Graphics g) {
        super.paint(g);
        Dimension size = getSize();

        int width = (int) size.getWidth();
        int height = (int) size.getHeight();

        if (screenBuffer == null) {
            screenBuffer = createImage(width, height);
        }

        graphicsBuffer = screenBuffer.getGraphics();

        drawEngineManager.onDraw(graphicsBuffer, cardGameMouseAdapter.hideCard);

        if (cardGameMouseAdapter.isMovingCard) {
            drawEngineManager.onDrawMovingCard(graphicsBuffer, cardGameMouseAdapter.hideCard,
                    cardGameMouseAdapter.mouseX, cardGameMouseAdapter.mouseY,
                    cardGameMouseAdapter.mouseDx, cardGameMouseAdapter.mouseDy);
        }
        g.drawImage(screenBuffer, 0, 0, null);

        screenBuffer = null;
    }

    class CardGameKeyAdapter extends KeyAdapter {
        public void keyPressed(KeyEvent e) {
            int keycode = e.getKeyCode();
            WinLog.i(TAG, Integer.toString(keycode));
            switch (keycode) {
                case KeyEvent.VK_S:
                case KeyEvent.VK_O:
                case KeyEvent.VK_P:
                case KeyEvent.VK_B:
                case KeyEvent.VK_ESCAPE:
                    PlayCommand cmd = commandFactory.CreateCommand(CommandFactory.KEYPRESS_EVENT, keycode, 0);
                    if (cmdEngine.runCommand(cmd)) {
                        updateMoveCount();
                        repaint();
                    }
                    break;

                case KeyEvent.VK_1:
                case KeyEvent.VK_2:
                case KeyEvent.VK_3:
                case KeyEvent.VK_4:
                case KeyEvent.VK_5:
                case KeyEvent.VK_6:
                case KeyEvent.VK_7:
                case KeyEvent.VK_8:
                    for (int i = 0; i < 4; i++) {
                        PlayCommand moveCmd = commandFactory.CreateCommand(CommandFactory.KEYPRESS_EVENT, keycode, i + Freecell.RESULT_DECK_1);
                        if (cmdEngine.runCommand(moveCmd)) {
                            updateMoveCount();
                            repaint();
                            break;
                        }
                    }
                    break;

                case KeyEvent.VK_9:
                case KeyEvent.VK_0:
                case 45: // -
                case 61: // =
                    for (int i = 0; i < 4; i++) {
                        PlayCommand moveCmd = commandFactory.CreateCommand(CommandFactory.KEYPRESS_EVENT, keycode, i + Freecell.RESULT_DECK_1);
                        if (cmdEngine.runCommand(moveCmd)) {
                            updateMoveCount();
                            repaint();
                            break;
                        }
                    }
                    break;


                case KeyEvent.VK_Q:
                case KeyEvent.VK_W:
                case KeyEvent.VK_E:
                case KeyEvent.VK_R:
                case KeyEvent.VK_T:
                case KeyEvent.VK_Y:
                case KeyEvent.VK_U:
                case KeyEvent.VK_I:
                    for (int i = 0; i < 4; i++) {
                        PlayCommand moveCmd = commandFactory.CreateCommand(CommandFactory.KEYPRESS_EVENT, keycode, i + Freecell.EMPTY_DECK_1);
                        if (cmdEngine.runCommand(moveCmd)) {
                            updateMoveCount();
                            repaint();
                            break;
                        }
                    }
                    break;
            }
        }
    }

    class CardGameMouseAdapter extends MouseAdapter {
        public CardPosition StartPos;
        public CardPosition EndPos;
        public int mouseDx;
        public int mouseDy;

        private boolean isMovingCard = false;
        public LinkedList<Integer> hideCard = new LinkedList<Integer>();
        private int mouseX;
        private int mouseY;

        public void mouseClicked(MouseEvent e) {
            WinLog.i(TAG, "Mouse Clicked " + e.getX() + ":" + e.getY());

            deckPositionManager.initCardPosition(freecell);

            int mx = e.getX();
            int my = e.getY();

            PlayCommand cmd = commandFactory.CreateCommand(CommandFactory.MOUSE_CLICK_EVENT, mx, my);
            if (cmdEngine.runCommand(cmd)) {
                repaint();
                return;
            }

            CardPosition pos = deckPositionManager.getCardInfo(mx, my);

            if (pos == null || !freecell.isMovableDeck(pos.deck)) {
                return;
            }

            for (int i = 0; i < 4; i++) {
                PlayCommand moveCmd = commandFactory.CreateCommand(pos.deck, 0, i + Freecell.RESULT_DECK_1, 0);
                if (cmdEngine.runCommand(moveCmd)) {
                    repaint();
                    updateMoveCount();
                    return;
                }
            }

            for (int i = 0; i < 8; i++) {
                if (pos.deck == (i+Freecell.BOARD_DECK_1)) {
                    continue;
                }
                PlayCommand moveCmd = commandFactory.CreateCommand(pos.deck, 0, i + Freecell.BOARD_DECK_1, 0);
                if (cmdEngine.runCommand(moveCmd)) {
                    repaint();
                    updateMoveCount();
                    return;
                }
            }

            if (pos.deck >= Freecell.EMPTY_DECK_1 && pos.deck <= Freecell.EMPTY_DECK_4) {
                return;
            }

            for (int i = 0; i < 4; i++) {
                PlayCommand moveCmd = commandFactory.CreateCommand(pos.deck, 0, i + Freecell.EMPTY_DECK_1, 0);
                if (cmdEngine.runCommand(moveCmd)) {
                    repaint();
                    updateMoveCount();
                    return;
                }
            }
        }

        public void mouseEntered(MouseEvent e) {
            //WinLog.i(TAG, "Mouse Entered" + e.getX() + ":" + e.getY());
        }

        public void mouseExited(MouseEvent e) {
            //WinLog.i(TAG, "Mouse Exited");
        }

        public void mousePressed(MouseEvent e) {
            WinLog.i(TAG, "Mouse Pressed " + e.getX() + ":" + e.getY());
            mouseX = e.getX();
            mouseY = e.getY();
            mouseDx = 0;
            mouseDy = 0;

            deckPositionManager.initCardPosition(freecell);

            StartPos = deckPositionManager.getCardInfo(mouseX, mouseY);

            if (StartPos != null) {
                if (!freecell.isMovableDeck(StartPos.deck)) {
                    StartPos = null;
                    return;
                }
                makeHideCardList();
                isMovingCard = true;
                mouseDx = mouseX - StartPos.x1;
                mouseDy = mouseY - StartPos.y1;
                WinLog.i(TAG, "StartDeck :" + StartPos.toString());
            }
        }

        private void makeHideCardList() {
            hideCard.clear();

            if (!freecell.isPlayState()) {
                return;
            }

            int deck = StartPos.deck;
            int moveCount = StartPos.position + 1;

            //WinLog.i(TAG, "paint " + Integer.toString(deck) + ":" + Integer.toString(moveCount));

            for (int i = 0; i < moveCount; i++) {
                Card card = freecell.getDeck(deck).get(i);
                if (card != null) {
                    // WinLog.i(TAG, card.toString());
                    int cardNumber = (card.getFigure().getValue() - 1) * 13 + card.getNumber().getValue();
                    hideCard.push(cardNumber);
                    // WinLog.i(TAG, card.toString() + " : " + Integer.toString(imageNumber));
                } else {
                    WinLog.i(TAG, "Card is null!");
                }
            }
        }

        private boolean runCommand(CardPosition pos) {
            if (pos == null) {
                return false;
            }
            PlayCommand cmd = commandFactory.CreateCommand(StartPos.deck, StartPos.position, pos.deck, pos.position);

            if (cmdEngine.runCommand(cmd)) {
                updateMoveCount();
                repaint();
                return true;
            }

            return false;
        }

        public void mouseReleased(MouseEvent e) {
            WinLog.i(TAG, "Mouse Released " + e.getX() + ":" + e.getY());

            isMovingCard = false;

            if (StartPos == null) {
                return;
            }


            mouseX = e.getX();
            mouseY = e.getY();

            hideCard.clear();

            // Check left top of moving card
            EndPos = deckPositionManager.getCardInfo(mouseX - mouseDx, mouseY - mouseDy);

            if (runCommand(EndPos)) {
                return;
            }

            // Check the mouse X,Y
            EndPos = deckPositionManager.getCardInfo(mouseX, mouseY);

            if (runCommand(EndPos)) {
                return;
            }

            // Check Right top of moving card
            EndPos = deckPositionManager.getCardInfo(mouseX + (100 - mouseDx), mouseY - mouseDy);

            if (runCommand(EndPos)) {
                return;
            }

            updateMoveCount();
            repaint();
        }
    }

    class CardGameMouseMoveAdapter extends MouseMotionAdapter {
        public void mouseDragged(MouseEvent e) {
            // WinLog.i(TAG, "mouseDragged" + e.getX() + ":" + e.getY());
            if (cardGameMouseAdapter.isMovingCard) {
                cardGameMouseAdapter.mouseX = e.getX();
                cardGameMouseAdapter.mouseY = e.getY();
                repaint();
            }
        }

        public void mouseMoved(MouseEvent e) {
            // WinLog.i(TAG, "mouseMoved" + e.getX() + ":" + e.getY()););
        }
    }

}