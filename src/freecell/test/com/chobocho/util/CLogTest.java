package util;

import org.junit.Test;

import static org.junit.Assert.*;

public class CLogTest {
    @org.junit.Before
    public void setUp() throws Exception {
    }

    @org.junit.After
    public void tearDown() throws Exception {
    }

    @Test
    public void setDebugLevel() {
        CLog log = new CLog();
        assertEquals(log.SetDebugLevel(CLog.LOG_LEVEL_DEBUG) , CLog.LOG_LEVEL_DEBUG);
    }

    @Test
    public void d() {
        CLog log = new CLog();
        log.d("CLOG_TAG", "Hello, World!");
    }

    @Test
    public void i() {
    }

    @Test
    public void e() {
    }
}