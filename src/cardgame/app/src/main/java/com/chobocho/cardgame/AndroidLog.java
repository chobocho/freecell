package com.chobocho.cardgame;

import android.util.Log;
import com.chobocho.util.CLog;

public class AndroidLog extends CLog {
    public static void d(String TAG, String msg) {
        if (debugLevel < LOG_LEVEL_DEBUG) {
            return;
        }
        Log.d(TAG, msg);
    }

    public static void i(String TAG, String msg) {
        if (debugLevel < LOG_LEVEL_INFO) {
            return;
        }
        Log.i(TAG, msg);
    }

    public static void e(String TAG, String msg) {
        Log.e(TAG, msg);
    }
}
