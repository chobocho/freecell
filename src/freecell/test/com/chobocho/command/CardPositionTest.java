package test.com.chobocho.command;

import com.chobocho.command.CardPosition;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.*;

public class CardPositionTest {

    @Before
    public void setUp() throws Exception {
    }

    @After
    public void tearDown() throws Exception {
    }

    @Test
    public void set() {
    }

    @Test
    public void isInRange() {
        CardPosition pos = new CardPosition(0, 0, 10, 10, 100, 150);
        assertEquals(pos.toString(), "D:0 P:0 (10,10), (100,150)");
        assertEquals(pos.isInRange(5, 5), false);
        assertEquals(pos.isInRange(59, 50), true);
    }

    @Test
    public void testToString() {
        CardPosition pos = new CardPosition(0, 0, 10, 10, 100, 150);
        assertEquals(pos.toString(), "D:0 P:0 (10,10), (100,150)");
    }
}