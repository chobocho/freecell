package com.chobocho.cardgame;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;

import com.chobocho.command.CommandEngine;
import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.FreecellImpl;

public class MainActivity extends AppCompatActivity {
    Freecell freecell;
    CommandEngine cmdEngine;
    CardgameView gameView;
    BoardProfile boardProfile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        init();
        setContentView(gameView);
    }

    protected void init() {
        freecell = new FreecellImpl(new AndroidLog());
        cmdEngine = new CommandEngine(freecell);
        boardProfile = new BoardProfile();
        gameView = new CardgameView(this, boardProfile, freecell, cmdEngine);
        freecell.register(gameView);
    }
}
