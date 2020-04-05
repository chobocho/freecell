package game.ui;

import com.chobocho.freecell.Freecell;
import game.BoardProfile;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.LinkedList;

public interface DrawEngine {
    void onDraw(Graphics g, Freecell game, BoardProfile boardProfile, LinkedList<Integer> hideCard, BufferedImage[] cardImages, BufferedImage[] buttonImages);
}
