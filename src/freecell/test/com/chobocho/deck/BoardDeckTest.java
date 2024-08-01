package deck;

import com.chobocho.deck.BoardDeck;
import com.chobocho.deck.Deck;
import com.chobocho.deck.ResultDeckCheckMethod;
import org.junit.Test;

import static org.junit.Assert.*;

public class BoardDeckTest {

    @Test
    public void init() {
    }

    @Test
    public void clear() {
    }

    @Test
    public void push() {
    }

    @Test
    public void pop() {
    }

    @Test
    public void top() {
    }

    @Test
    public void get() {
    }

    @Test
    public void openTopCard() {
    }

    @Test
    public void openAll() {
    }

    @Test
    public void isAcceptable() {
    }

    @Test
    public void setCheckMethod() {
    }

    @Test
    public void testToString() {
        ResultDeckCheckMethod resultDeckCheckMethod = new ResultDeckCheckMethod();
        Deck deck = new BoardDeck(resultDeckCheckMethod);
        assertEquals(deck.size(), 0);
    }

    @Test
    public void size() {
    }
}