package game.ui;

import com.chobocho.freecell.Freecell;
import game.BoardProfile;
import game.CardGameGui;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.LinkedList;

public class PauseDrawEngineImpl extends DrawEngineImpl implements DrawEngine {
    final static String TAG = "PauseDrawEngineImpl";
    int width = 100;
    int height = 150;
    int cardCap = 20;
    int screenW = 910;

    public PauseDrawEngineImpl() {
    }

    @Override
    public void onDraw(Graphics g, Freecell game, BoardProfile boardProfile, LinkedList<Integer> hideCard, BufferedImage[] cardImages, BufferedImage[] buttonImages) {
        g.drawImage(buttonImages[CardGameGui.RESME_GAME_IMAGE], (screenW-200)/2, 250, null);
        g.drawImage(buttonImages[CardGameGui.NEW_GAME_IMAGE], (screenW-200)/2, 450, null);
    }
}
