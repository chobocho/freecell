package test.com.chobocho.freecell;

import com.chobocho.card.Card;
import com.chobocho.freecell.Freecell;
import com.chobocho.freecell.PlayState;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.*;

public class PlayStateTest {
    PlayState playState;

    @Before
    public void setUp() throws Exception {
        playState = new PlayState();
    }

    @After
    public void tearDown() throws Exception {
        playState = null;
    }

    @Test
    public void initGame(){
        assertEquals(playState.isFinishGame(), false);
        System.out.println(playState);
    }

    @Test
    public void moveCard() {
        System.out.println("moveCard");
        Card card1 = new Card(Card.FIGURE.SPADE,Card.NUMBER.QUEEN);
        assertEquals(card1.open(), true);
        Card card2 = new Card(Card.FIGURE.HEART,Card.NUMBER.KING);
        assertEquals(card2.open(), true);
        Card card3 = new Card(Card.FIGURE.DIAMOND,Card.NUMBER.JACK);
        assertEquals(card3.open(), true);

        playState.initGame();
        playState.getDeck(Freecell.BOARD_DECK_1).clear();
        assertEquals(playState.getDeck(Freecell.BOARD_DECK_1).push(card2), true);
        assertEquals(playState.getDeck(Freecell.BOARD_DECK_1).push(card1), true);
        assertEquals(playState.getDeck(Freecell.BOARD_DECK_1).push(card3), true);
        playState.getDeck(Freecell.BOARD_DECK_2).clear();
        Card card4 = new Card(Card.FIGURE.DIAMOND,Card.NUMBER.KING);
        assertEquals(card4.open(), true);
        assertEquals(playState.getDeck(Freecell.BOARD_DECK_2).push(card4), true);
        assertEquals(playState.moveCard(Freecell.BOARD_DECK_1, Freecell.BOARD_DECK_2, 2), true);
        System.out.println(playState);

        // Result Deck check
        Card carda = new Card(Card.FIGURE.SPADE,Card.NUMBER.ACE);
        assertEquals(carda.open(), true);
        assertEquals(playState.getDeck(Freecell.RESULT_DECK_1).push(carda), true);
        Card card5 = new Card(Card.FIGURE.SPADE,Card.NUMBER.THREE);
        assertEquals(card5.open(), true);
        assertEquals(playState.getDeck(Freecell.RESULT_DECK_1).push(card5), false);
    }

    @Test
    public void testHistory() {
        System.out.println("testHistory");
        playState.initGame();
        String orignal = playState.toString();
        System.out.println(orignal);
        playState.moveCard(Freecell.BOARD_DECK_1, Freecell.EMPTY_DECK_1,1);
        playState.moveCard(Freecell.BOARD_DECK_1, Freecell.EMPTY_DECK_2,1);
        String afterMove = playState.toString();
        System.out.println(afterMove);
        playState.revert();
        playState.revert();
        playState.revert();
        String afterBack = playState.toString();
        System.out.println(afterBack);
        assertEquals(orignal, afterBack);
    }
}