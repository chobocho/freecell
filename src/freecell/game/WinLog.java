package game;

import com.chobocho.util.CLog;

public class WinLog extends CLog {
    public static void d(String TAG, String msg) {
        if (debugLevel < LOG_LEVEL_DEBUG) {
            return;
        }
        System.out.println(TAG + " " + msg);
    }

    public static void i(String TAG, String msg) {
        if (debugLevel < LOG_LEVEL_INFO) {
            return;
        }
        System.out.println(TAG + " " + msg);
    }

    public static void e(String TAG, String msg) {
        System.out.println(TAG + " " + msg);
    }
}
