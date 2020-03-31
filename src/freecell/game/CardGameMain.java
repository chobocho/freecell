package game;

import com.chobocho.command.CommandEngine;
import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.FreecellImpl;

import javax.swing.*;
import java.awt.*;

public class CardGameMain extends JFrame {
    String TAG = "CardGameMain";
    String Version = "V0.1105.TD1.1";
    JLabel statusbar;

    public CardGameMain() {
        WinLog.i(TAG, "CardGameMain: " + Version);
        statusbar = new JLabel("Press S to play game");
        statusbar.setFont(new Font(statusbar.getFont().getFontName(), Font.PLAIN, 18));
        add(statusbar, BorderLayout.SOUTH);

        Freecell freecell = new FreecellImpl(new WinLog());
        CommandEngine cmdEngine = new CommandEngine(freecell);
        CardGameGui cardGameGui = new CardGameGui(this, freecell, cmdEngine);
        freecell.register(cardGameGui);
        add(cardGameGui);

        cardGameGui.start();

        setSize(910, 800);
        setTitle("Freecell " + Version);
        setDefaultCloseOperation(EXIT_ON_CLOSE);
    }

    public JLabel getStatusBar() {
        return statusbar;
    }

    public static void main(String[] args) {
        CardGameMain cardGame = new CardGameMain();
        cardGame.setLocationRelativeTo(null);
        cardGame.setVisible(true);
    }
}