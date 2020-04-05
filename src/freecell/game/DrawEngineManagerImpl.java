package game;

import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.GameObserver;
import game.BoardProfile;
import game.CardGameGui;
import game.WinLog;
import game.ui.*;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.LinkedList;

public class DrawEngineManagerImpl implements DrawEngineManager, GameObserver {
    final static String TAG = "DrawEngineManagerImpl";
    Freecell game;
    BoardProfile boardProfile;
    CardGameGui parent;

    private DrawEngine drawEngine;
    DrawEngine[] boardDrawEngines;
    private DrawEngine idleDrawEngine;
    private DrawEngine playDrawEngine;
    private DrawEngine pauseDrawEngine;
    private DrawEngine endDrawEngine;
    private DrawEngine commonDrawEngine;

    BufferedImage[] cardImages = null;
    BufferedImage[] buttonImages = null;

    public DrawEngineManagerImpl(Freecell game, BoardProfile boardProfile, CardGameGui parent) {
        this.game = game;
        this.boardProfile = boardProfile;
        this.parent = parent;

        this.commonDrawEngine = new CommonDrawEngineImpl();
        boardDrawEngines = new DrawEngine[Freecell.END_STATE + 1];
        boardDrawEngines[Freecell.IDLE_STATE] = new IdleDrawEngineImpl();
        boardDrawEngines[Freecell.PLAY_STATE] = new PlayDrawEngineImpl();
        boardDrawEngines[Freecell.PAUSE_STATE] = new PauseDrawEngineImpl();
        boardDrawEngines[Freecell.END_STATE] = new EndDrawEngineImpl();
        drawEngine = boardDrawEngines[Freecell.IDLE_STATE];

        loadImage();

        game.register(this);
    }

    public void updateState(int state) {
        WinLog.i(TAG, "STATE: " + state);
        switch (state) {
            case Freecell.IDLE_STATE:
                drawEngine = boardDrawEngines[Freecell.IDLE_STATE];
                break;
            case Freecell.PLAY_STATE:
                drawEngine = boardDrawEngines[Freecell.PLAY_STATE];
                break;
            case Freecell.PAUSE_STATE:
                drawEngine = boardDrawEngines[Freecell.PAUSE_STATE];
                break;
            case Freecell.END_STATE:
                drawEngine = boardDrawEngines[Freecell.END_STATE];
                break;
            default:
                break;
        }
        this.parent.updateStatusBar(state);
        this.parent.update();
    }

    @Override
    public void onDraw(Graphics g, LinkedList<Integer> hideCard) {
        commonDrawEngine.onDraw(g, game, boardProfile, hideCard, cardImages, buttonImages);
        drawEngine.onDraw(g, game, boardProfile,  hideCard, cardImages, buttonImages);
    }

    @Override
    public void onDrawMovingCard(Graphics g, LinkedList<Integer> hideCard, int mouseX, int mouseY, int mouseDx, int mouseDy) {
        for (int i = 0; i < hideCard.size(); i++) {
            int px = mouseX - mouseDx;
            int py = mouseY - mouseDy;
            g.drawImage(cardImages[hideCard.get(i)], px, py + i * 40, null);
        }
    }

    private void loadImage() {
        cardImages = new BufferedImage[BoardProfile.CardImageName.length + 1];
        loadImage(BoardProfile.CardImageName, cardImages);

        buttonImages = new BufferedImage[BoardProfile.ButtonImageName.length + 1];
        loadImage(BoardProfile.ButtonImageName, buttonImages);
        WinLog.i(TAG, "Load image Success!");
    }

    private void loadImage(String[] imageName, BufferedImage[] images) {
        for (int i = 0; i < imageName.length; i++) {
            try {
                images[i] = ImageIO.read(getClass().getResource(imageName[i]));
                WinLog.i(TAG, "Load image Success! " + imageName[i]);
            } catch (IOException e) {
                WinLog.i(TAG, "Load image fail! " + imageName[i]);
            }
        }
    }

}
