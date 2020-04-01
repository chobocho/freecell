package game;

import com.chobocho.card.Card;
import com.chobocho.command.*;
import com.chobocho.freecell.GameObserver;
import com.chobocho.freecell.GameState;
import com.chobocho.freecell.Freecell;
import game.cmd.DeckPositoinManagerImpl;
import game.ui.*;

import java.awt.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.LinkedList;

import javax.imageio.ImageIO;
import javax.swing.JLabel;
import javax.swing.JPanel;

public class CardGameGui extends JPanel implements GameObserver {
    static final String TAG = "CardGameGui";
    JLabel statusbar;

    private Image screenBuffer = null;
    private Graphics graphicsBuffer = null;

    private Freecell freecell;
    private CommandEngine cmdEngine;
    private DrawEngine drawEngine;
    private DrawEngine idleDrawEngine;
    private DrawEngine playDrawEngine;
    private DrawEngine pauseDrawEngine;
    private DrawEngine endDrawEngine;
    private DrawEngine commonDrawEngine;
    private CommandFactory commandFactory;
    private DeckPositoinManager deckPositoinManager;

    BufferedImage[] cardImages = null;

    public final static int CARD_BG_IMAGE = 0;
    public final static int CARD_NONE_IMAGE = 53;
    private CardGameMouseAdapter cardGameMouseAdapter;

    final public static int NEW_GAME_IMAGE = 0;
    final public static int PLAY_GAME_IMAGE = 1;
    final public static int RESME_GAME_IMAGE = 2;

    String[] buttonImageName = {
            "/img/newgame.png",
            "/img/start.png",
            "/img/resume.png"
    };

    BufferedImage[] buttonImage = null;

    String[] imageName = {
            "/img/BG.png",
            "/img/CA.png",
            "/img/C2.png",
            "/img/C3.png",
            "/img/C4.png",
            "/img/C5.png",
            "/img/C6.png",
            "/img/C7.png",
            "/img/C8.png",
            "/img/C9.png",
            "/img/C10.png",
            "/img/CJ.png",
            "/img/CQ.png",
            "/img/CK.png",
            "/img/DA.png",
            "/img/D2.png",
            "/img/D3.png",
            "/img/D4.png",
            "/img/D5.png",
            "/img/D6.png",
            "/img/D7.png",
            "/img/D8.png",
            "/img/D9.png",
            "/img/D10.png",
            "/img/DJ.png",
            "/img/DQ.png",
            "/img/DK.png",
            "/img/HA.png",
            "/img/H2.png",
            "/img/H3.png",
            "/img/H4.png",
            "/img/H5.png",
            "/img/H6.png",
            "/img/H7.png",
            "/img/H8.png",
            "/img/H9.png",
            "/img/H10.png",
            "/img/HJ.png",
            "/img/HQ.png",
            "/img/HK.png",
            "/img/SA.png",
            "/img/S2.png",
            "/img/S3.png",
            "/img/S4.png",
            "/img/S5.png",
            "/img/S6.png",
            "/img/S7.png",
            "/img/S8.png",
            "/img/S9.png",
            "/img/S10.png",
            "/img/SJ.png",
            "/img/SQ.png",
            "/img/SK.png",
            "/img/none.png"
    };

    public CardGameGui(CardGameMain parent, Freecell freecell, CommandEngine cmdEngine) {
        loadImage();
        this.freecell = freecell;
        this.cmdEngine = cmdEngine;
        this.idleDrawEngine = new IdleDrawEngineImpl();
        this.playDrawEngine = new PlayDrawEngineImpl();
        this.pauseDrawEngine = new PauseDrawEngineImpl();
        this.endDrawEngine = new EndDrawEngineImpl();
        this.commonDrawEngine = new CommonDrawEngineImpl();
        this.deckPositoinManager = new DeckPositoinManagerImpl();

        drawEngine = this.idleDrawEngine;

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

    public void updateState(int state) {
        WinLog.i(TAG, "STATE: " + state);
        switch (state) {
            case GameState.IDLE_STATE:
                drawEngine = idleDrawEngine;
                break;
            case GameState.PLAY_STATE:
                drawEngine = playDrawEngine;
                break;
            case GameState.PAUSE_STATE:
                drawEngine = pauseDrawEngine;
                break;
            case GameState.END_STATE:
                drawEngine = endDrawEngine;
                break;
            default:
                break;
        }
        updateStatusBar(state);
        repaint();
    }

    private void updateStatusBar(int state) {
        switch (state) {
            case GameState.IDLE_STATE:
                statusbar.setText(" Press S to start game!");
                break;
            case GameState.PLAY_STATE:
                statusbar.setText(" [Help] ESC or P:  pause game | B:  Revert | " + freecell.getMoveCount() + " moved");
                break;
            case GameState.PAUSE_STATE:
                statusbar.setText(" Press S or R to resume game!");
                break;
            case GameState.END_STATE:
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
        commonDrawEngine.onDraw(graphicsBuffer, freecell, cardGameMouseAdapter.hideCard, cardImages, buttonImage);
        drawEngine.onDraw(graphicsBuffer, freecell, cardGameMouseAdapter.hideCard, cardImages, buttonImage);

        if (cardGameMouseAdapter.isMovingCard) {
            for (int i = 0; i < cardGameMouseAdapter.hideCard.size(); i++) {
                int px = cardGameMouseAdapter.mouseX - cardGameMouseAdapter.mouseDx;
                int py = cardGameMouseAdapter.mouseY - cardGameMouseAdapter.mouseDy;
                graphicsBuffer.drawImage(cardImages[cardGameMouseAdapter.hideCard.get(i)], px, py + i * 40, null);
            }
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

            deckPositoinManager.initCardPosition(freecell);

            int mx = e.getX();
            int my = e.getY();

            PlayCommand cmd = commandFactory.CreateCommand(CommandFactory.MOUSE_CLICK_EVENT, mx, my);
            if (cmdEngine.runCommand(cmd)) {
                repaint();
                return;
            }

            CardPosition pos = deckPositoinManager.getCardInfo(mx, my);

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

            deckPositoinManager.initCardPosition(freecell);

            StartPos = deckPositoinManager.getCardInfo(mouseX, mouseY);

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

            if (drawEngine != playDrawEngine) {
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
            EndPos = deckPositoinManager.getCardInfo(mouseX - mouseDx, mouseY - mouseDy);

            if (runCommand(EndPos)) {
                return;
            }

            // Check the mouse X,Y
            EndPos = deckPositoinManager.getCardInfo(mouseX, mouseY);

            if (runCommand(EndPos)) {
                return;
            }

            // Check Right top of moving card
            EndPos = deckPositoinManager.getCardInfo(mouseX + (100 - mouseDx), mouseY - mouseDy);

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

    private void loadImage() {
        cardImages = new BufferedImage[imageName.length + 1];
        for (int i = 0; i < imageName.length; i++) {
            try {
                cardImages[i] = ImageIO.read(getClass().getResource(imageName[i]));
                WinLog.i(TAG, "Load image Success! " + imageName[i]);
            } catch (IOException e) {
                WinLog.i(TAG, "Load image fail! " + imageName[i]);
            }
        }

        buttonImage = new BufferedImage[buttonImageName.length + 1];

        for (int i = 0; i < buttonImageName.length; i++) {
            try {
                buttonImage[i] = ImageIO.read(getClass().getResource(buttonImageName[i]));
                WinLog.i(TAG, "Load image Success! " + buttonImageName[i]);
            } catch (IOException e) {
                WinLog.i(TAG, "Load image fail! " + buttonImageName[i]);
            }
        }

        WinLog.i(TAG, "Load image Success!");
    }
}