package com.chobocho.freecell;

import com.chobocho.card.Card;
import com.chobocho.deck.*;
import com.chobocho.util.CLog;

import java.util.ArrayList;
import java.util.LinkedList;

public class PlayState extends GameState {
    final static String TAG = "PlayState";

    Deck[] resultDeck;
    Deck[] emptyDeck;
    Deck[] boardDeck;
    Deck initDeck;
    ArrayList<Deck> deckList;
    LinkedList<MoveCommand> history;
    int moveCount = 0;

    public PlayState() {
        initVars();
        initDeckList();
        initGame();
    }

    private void initVars() {
        history = new LinkedList<MoveCommand>();
        deckList = new ArrayList<Deck>();
        initDeck = new InitDeck();

        ResultDeckCheckMethod resultDeckCheckMethod = new ResultDeckCheckMethod();
        resultDeck = new BoardDeck[4];
        for (int i = 0; i < resultDeck.length; i++) {
            resultDeck[i] = new BoardDeck(resultDeckCheckMethod);
        }

        EmptyDeckCheckMethod emptyDeckCheckMethod = new EmptyDeckCheckMethod();
        emptyDeck = new BoardDeck[4];
        for (int i = 0; i < emptyDeck.length; i++) {
            emptyDeck[i] = new BoardDeck(emptyDeckCheckMethod);
        }

        BoardDeckCheckMethod boardDeckCheckMethod = new BoardDeckCheckMethod();
        boardDeck = new BoardDeck[8];
        for (int i = 0; i < boardDeck.length; i++) {
            boardDeck[i] = new BoardDeck(boardDeckCheckMethod);
        }
    }

    private void initDeckList() {
        deckList.add(initDeck);

        for (Deck deck: resultDeck) {
            deckList.add(deck);
        }

        for (Deck deck: emptyDeck) {
            deckList.add(deck);
        }

        for (Deck deck: boardDeck) {
            deckList.add(deck);
        }
    }

    public void initGame() {
        initBoard();
    }

    private void initBoard() {
        moveCount = 0;
        history.clear();
        initDeck.init();
        for (Deck deck : deckList) {
            deck.init();
        }

        runInitBoardCmd();
    }

    private void runInitBoardCmd() {
        int i = 0;
        while(!initDeck.isEmpty()) {
            deckList.get(Freecell.BOARD_DECK_1+i).push(initDeck.pop());
            i = (++i) % 8;
        }

        for (Deck deck: boardDeck) {
            deck.openAll();
        }
    }

    private boolean moveCard(int from, int to) {
        //CLog.i(TAG,"Try to move card from " + from + " to " + to);
        if (deckList.get(from).isEmpty()) {
            CLog.e(TAG,"Deck " + from + " is empty!");
            return false;
        }

        if (from >= Freecell.RESULT_DECK_1 && from <= Freecell.RESULT_DECK_4) {
            return false;
        }

        Card card = deckList.get(from).top();
        boolean result = deckList.get(to).push(card);

        if (!result) {
            CLog.i(TAG,"Move card failed from " + from + " to " + to);
            return false;
        }

        deckList.get(from).pop();
        return true;
    }

    private int getEmpytDeckCount() {
        int result = 0;

        for (Deck deck: emptyDeck) {
            if (deck.isEmpty()) {
                result++;
            }
        }

        for (Deck deck: boardDeck) {
            if (deck.isEmpty()) {
                result++;
            }
        }
        return result;
    }

    @Override
    public boolean moveCard(int from, int to, int count) {
        boolean result = false;

        if (count == 1) {
            result = moveCard(from, to);
            if (result) {
                pushHistory(new MoveCommand(from, to, 1));
                moveCount++;
            }
            return result;
        }

        if (count > getEmpytDeckCount()+1) {
            CLog.i(TAG, "Empty deck count is samller than " + count);
            return false;
        }

        Deck deck = new PlayDeck();

        for (int i = 0; i < count; i++) {
            deck.push(deckList.get(from).get(i));
        }

        Card card = deck.top();

        if (deckList.get(to).push(card)) {
            deck.pop();
            while(!deck.isEmpty()) {
                deckList.get(to).push(deck.pop());
            }
            for (int i = 0; i < count; i++) {
               deckList.get(from).pop();
            }
            moveCount++;
            pushHistory(new MoveCommand(from, to, count));
            return true;
        } else {
            CLog.i(TAG, deck.toString());
            CLog.i(TAG, deckList.get(from).toString());
        }
        return false;
    }

    private void moveCardFroced(int from, int to, int count) {
        for (int i = 0; i < count; i++) {
            Card card = deckList.get(from).pop();
            card.close();
            deckList.get(to).push(card);
        }
        deckList.get(to).openAll();
    }

    @Override
    public boolean openCard(int deckNum) {
        CLog.i(TAG, "openCard " + deckNum);
        return deckList.get(deckNum).openTopCard();
    }

    public Deck getDeck(int deck) {
        return deckList.get(deck);
    }

    public String toString() {
        StringBuffer result = new StringBuffer();

        for(int i = 0; i < deckList.size(); i++) {
            result.append(i + " size " + deckList.get(i).size() + ": " + deckList.get(i) + "\n");
        }

        result.append("History: \n");
        for(int i = 0; i < history.size(); i++) {
            result.append(history.get(i).toStinrg() + "\n");
        }
        return result.toString();
    }

    public int getState() { return PLAY_STATE; }

    @Override
    public boolean isPlayState() {
        return true;
    }

    @Override
    public boolean isFinishGame() {
        return (deckList.get(Freecell.RESULT_DECK_1).size() == 13) &&
                (deckList.get(Freecell.RESULT_DECK_2).size() == 13) &&
                (deckList.get(Freecell.RESULT_DECK_3).size() == 13) &&
                (deckList.get(Freecell.RESULT_DECK_4).size() == 13);
    }

    @Override
    public boolean back() {
        if (history.isEmpty()) return false;
        MoveCommand cmd = history.pop();
        moveCardFroced(cmd.to, cmd.from, cmd.count);
        moveCount++;
        return true;
    }

    private void pushHistory(MoveCommand cmd) {
        history.push(cmd);
    }

    public int getMoveCount() {
        return moveCount;
    }
}