package deck;

import com.chobocho.card.Card;
import com.chobocho.deck.Deck;
import com.chobocho.deck.InitDeck;
import org.junit.Test;

import static org.junit.Assert.*;

public class InitDeckTest {

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
    public void testToString() {
        Deck deck = new InitDeck();
        assertEquals(deck.size(), 52);
        Card card = deck.get(0);
        assertEquals(card.getNumber(), deck.top().getNumber());
    }
}