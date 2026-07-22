package com.chobocho.cardgame;


import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // API 30 이상에서 decorView가 attach된 이후에 시스템 UI 숨김 실행
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }

        setContentView(R.layout.activity_main);
        initWebView();
		
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

    private void initWebView() {
        WebView webview = (WebView) findViewById(R.id.gameview);
        webview.getSettings().setJavaScriptEnabled(true);
        webview.getSettings().setDomStorageEnabled(true);
        webview.loadUrl("file:///android_asset/index.html");

        webview.setWebChromeClient(new WebChromeClient() {
        @Override
        public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {

            new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Solitaire")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok,
                            new DialogInterface.OnClickListener() {
                                public void onClick(DialogInterface dialog, int which) {
                                    result.confirm();
                                }
                            })
                    .setNegativeButton(android.R.string.cancel,
                            new DialogInterface.OnClickListener() {
                                @Override
                                public void onClick(DialogInterface dialog, int which) {
                                    result.cancel();
                                }
                            })
                    .setCancelable(false)
                    .create()
                    .show();
            return true;
        }
    });
    }
}