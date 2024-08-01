package card;

import com.chobocho.card.Card;
import org.junit.Test;

import static org.junit.Assert.*;

public class CardTest {

    @org.junit.Before
    public void setUp() throws Exception {
    }

    @org.junit.After
    public void tearDown() throws Exception {
    }

    @Test
    public void InitCard() throws Exception {
        Card card = new Card(Card.FIGURE.SPADE, Card.NUMBER.ACE);
        assert(Card.FIGURE.SPADE == card.getFigure());
        assertEquals(card.toString(), "S1_C");
    }

    @Test
    public void testFigure() throws Exception {
        Card card = new Card(Card.FIGURE.SPADE, Card.NUMBER.ACE);
        assert(card.getFigure().getValue() == 4);
    }

    @Test
    public void testNumber() throws Exception {
        Card card = new Card(Card.FIGURE.SPADE, Card.NUMBER.ACE);
        assert(card.getNumber().getValue() == 1);
    }

    @Test
    public void testInt() throws Exception {
        Card card = new Card(Card.FIGURE.SPADE, Card.NUMBER.ACE);
        assertEquals(card.toInt(), 130);
        Card card2 = new Card(130);
        assertEquals(card.getFigure(), card2.getFigure());
        assertEquals(card.toString(), card2.toString());
    }
}