package com.chobocho.util;

public class CLog {
    public static int LOG_LEVEL_DEBUG = 5;
    public static int LOG_LEVEL_INFO = 3;
    public static int LOG_LEVEL_ERROR = 1;

    protected static int debugLevel = LOG_LEVEL_INFO;

    public static int SetDebugLevel(int level) {
        if ((level > LOG_LEVEL_DEBUG) || (level < LOG_LEVEL_ERROR)) {
            return -1;
        }
        debugLevel = level;
        return debugLevel;
    }

    public static void d(String TAG, String msg) {
        if (debugLevel < LOG_LEVEL_DEBUG) {
            return;
        }
    }

    public static void i(String TAG, String msg) {
        if (debugLevel < LOG_LEVEL_INFO) {
            return;
        }
        System.out.println(TAG + ": " + msg);
    }

    public static void e(String TAG, String msg) {
        System.out.println(TAG + ": " + msg);
    }
}
