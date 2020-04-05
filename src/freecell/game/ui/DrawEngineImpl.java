package game.ui;

import java.awt.*;
import java.awt.image.BufferedImage;

public class DrawEngineImpl {
    protected void drawImage(Graphics g, BufferedImage image, int x, int y) {
        g.drawImage(image, x, y, null);

    }

    /*
    // For android
    protected void drawImage(Canvas g, Bitmap image, int x, int y, int w, int h, Paint paint) {
        g.drawBitmap(image, null, new Rect(x, y,  x+w, y+h), paint);
    }
    */
}
