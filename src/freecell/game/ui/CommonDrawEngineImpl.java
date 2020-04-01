package game.ui;

import com.chobocho.freecell.Freecell;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.LinkedList;

public class CommonDrawEngineImpl implements DrawEngine {
    @Override
    public void onDraw(Graphics g, Freecell game, LinkedList<Integer> hideCard, BufferedImage[] cardImages, BufferedImage[] buttonImages) {
        onDrawCommon(g, cardImages, buttonImages);
    }

    private void onDrawCommon(Graphics g, BufferedImage[] cardImages, BufferedImage[] buttonImages) {
        int screenW = 910;
        int screenH = 900;
        int CARD_BG_IMAGE = 0;
        int CARD_NONE_IMAGE = 53;
        int CARD_A_BG_IMAGE = 54;

        g.setColor(new Color(88, 214, 141 ));
        g.fillRect(0, 0, screenW, screenH);

        int width = 100;
        int height = 150;

        // Result Deck
        g.drawImage(cardImages[CARD_A_BG_IMAGE], 10, 10, null);
        g.drawImage(cardImages[CARD_A_BG_IMAGE], 20+width, 10, null);
        g.drawImage(cardImages[CARD_A_BG_IMAGE], 30+width*2, 10, null);
        g.drawImage(cardImages[CARD_A_BG_IMAGE], 40+width*3, 10, null);
        // Empyt Deck
        g.drawImage(cardImages[CARD_BG_IMAGE], 50+width*4, 10, null);
        g.drawImage(cardImages[CARD_BG_IMAGE], 60+width*5, 10, null);
        g.drawImage(cardImages[CARD_BG_IMAGE], 70+width*6, 10, null);
        g.drawImage(cardImages[CARD_BG_IMAGE], 80+width*7, 10, null);

        g.drawImage(cardImages[CARD_NONE_IMAGE], 10, 20+height, null);
        g.drawImage(cardImages[CARD_NONE_IMAGE], 20+width, 20+height, null);
        g.drawImage(cardImages[CARD_NONE_IMAGE], 30+width*2, 20+height, null);
        g.drawImage(cardImages[CARD_NONE_IMAGE], 40+width*3, 20+height, null);
        g.drawImage(cardImages[CARD_NONE_IMAGE], 50+width*4, 20+height, null);
        g.drawImage(cardImages[CARD_NONE_IMAGE], 60+width*5, 20+height, null);
        g.drawImage(cardImages[CARD_NONE_IMAGE], 70+width*6, 20+height, null);
        g.drawImage(cardImages[CARD_NONE_IMAGE], 80+width*7, 20+height, null);
    }
}
