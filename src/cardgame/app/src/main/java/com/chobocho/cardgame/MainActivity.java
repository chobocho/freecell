package com.chobocho.cardgame;

import androidx.appcompat.app.AppCompatActivity;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.view.*;
import androidx.appcompat.app.AppCompatActivity;
import android.annotation.SuppressLint;
import android.graphics.Insets;
import android.graphics.Point;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Display;

import com.chobocho.command.CommandEngine;
import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.FreecellImpl;

public class MainActivity extends AppCompatActivity {
    final static String TAG = "Freecell";
    Freecell freecell;
    CommandEngine cmdEngine;
    CardgameView gameView;
    BoardProfile boardProfile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // API 30 이상에서 decorView가 attach된 이후에 시스템 UI 숨김 실행
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }

        init();
        setContentView(gameView);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // DecorView가 attach된 후에 실행하도록 post() 사용
            getWindow().getDecorView().post(new Runnable() {
                @Override
                public void run() {
                    WindowInsetsController insetsController = getWindow().getInsetsController();
                    if (insetsController != null) {
                        insetsController.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                        insetsController.setSystemBarsBehavior(
                                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                        );
                    }
                }
            });
        } else {
            @SuppressWarnings("deprecation")
            int flags = View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    protected void init() {
        String version = getVersion();

        int safeWidth;
        int safeHeight;

        WindowManager windowManager = getWindowManager();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowMetrics windowMetrics = windowManager.getCurrentWindowMetrics();
            Rect bounds = windowMetrics.getBounds();
            WindowInsets insets = windowMetrics.getWindowInsets();
            Insets systemInsets = insets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
            );
            safeWidth = bounds.width() - systemInsets.left - systemInsets.right;
            safeHeight = bounds.height() - systemInsets.top - systemInsets.bottom;
        } else {
            // API 29 이하일 때: 기존 방식 사용
            Display display = windowManager.getDefaultDisplay();
            Point size = new Point();
            display.getSize(size);
            safeWidth = size.x;
            safeHeight = size.y;
        }

        freecell = new FreecellImpl(new AndroidLog());
        cmdEngine = new CommandEngine(freecell);
        boardProfile = new BoardProfile(version, safeWidth, safeHeight);
        gameView = new CardgameView(this, boardProfile, freecell, cmdEngine);
        freecell.register(gameView);
    }

    @Override
    public void onPause() {
        super.onPause();
        if (gameView != null) {
            gameView.pauseGame();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (gameView != null) {
            gameView.resumeGame();
        }
    }

    private String getVersion() {
        try {
            PackageInfo pkgInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            String version = pkgInfo.versionName;
            Log.i(TAG, "Version Name : "+ version);
            return version;
        } catch(PackageManager.NameNotFoundException e) {
            e.printStackTrace();
            Log.i(TAG, e.toString());
        }
        return "";
    }
}
