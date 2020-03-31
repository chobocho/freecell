package com.chobocho.cardgame;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;

import com.chobocho.command.CommandEngine;
import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.FreecellImpl;

public class MainActivity extends AppCompatActivity {
    Freecell freecell = new FreecellImpl(new AndroidLog());
    CommandEngine cmdEngine = new CommandEngine(freecell);
    CardgameView gameView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        init();
        setContentView(gameView);
    }

    protected void init() {
        gameView = new CardgameView(this, freecell, cmdEngine);
        freecell.register(gameView);
    }
}
