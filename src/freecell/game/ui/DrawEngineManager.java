package game.ui;

import java.awt.*;
import java.util.LinkedList;

public interface DrawEngineManager {
    void onDraw(Graphics g, LinkedList<Integer> hideCard);
    void onDrawMovingCard(Graphics g, LinkedList<Integer> hideCard, int mouseX, int mouseY, int mouseDx, int mouseDy);
}
