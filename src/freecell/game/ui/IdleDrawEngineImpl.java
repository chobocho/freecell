package game.ui;

import com.chobocho.freecell.Freecell;
import game.BoardProfile;
import game.CardGameGui;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.LinkedList;

public class IdleDrawEngineImpl extends DrawEngineImpl implements DrawEngine {
    final static String TAG = "IdleDrawEngineImpl";
    final static int CARD_NONE_IMAGE = 53;
    int width = 100;
    int height = 150;
    int cardCap = 20;
    int screenW = 910;
    BufferedImage startImg;

    @Override
    public void onDraw(Graphics g, Freecell game, BoardProfile boardProfile, LinkedList<Integer> hideCard, BufferedImage[] cardImages, BufferedImage[] buttonImages) {
        g.drawImage(buttonImages[CardGameGui.PLAY_GAME_IMAGE], (screenW-200)/2, 300, null);
    }

    private void onDrawBoardDeck(Graphics g, BufferedImage[] cardImages, Freecell game) {

    }
}
