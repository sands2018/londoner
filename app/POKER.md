# Sands2018 poker games

The lobby exposes Texas Hold'em at `#holdem` and Three Card Poker at
`#threecard`. Both use virtual chips, separate balances and local saves,
desktop/mobile layouts, sequential cards, history (latest 200 hands), statistics,
and the existing emerald/gold design. No new runtime dependencies are required.

## Texas Hold'em

One human and five computer seats play no-limit Hold'em with 50/100 blinds and
10,000 starting chips per seat. The button rotates clockwise. The engine deals
two private cards, burns before each board street, and selects the best five
of seven cards. Suits do not break ties. No rake is taken.

Actions include fold, check, call, raise to a specified total, and all-in. A full
raise sets the minimum increment. Short all-ins do not automatically reopen
betting for players who already acted; cumulative increases can reopen it.
For example, an opening all-in of 50 with a 100 minimum requires an unacted
player to raise to at least 150. Main and side pots are settled separately;
uncalled excess is returned and odd chips go clockwise from the button's left.

Computer players use only their own hole cards, public board, public pot size
and legal actions. A small local Monte Carlo calculation estimates equity,
then fixed seat tendencies and random variation select an action. They never
receive actual opposing hole cards or the remaining deck. There is no LLM,
AI API, server, or network call in this decision path. This is casual computer
opposition, not a trained poker solver or a multiplayer service.

Computer seats below a big blind refill to 10,000 between hands. The human can
add virtual chips between hands; deposits do not count as profit. Leaving the
table or hiding the page pauses computer actions. After folding, the human can
skip to the end of the hand. Saved private cards remain local in the browser;
this is not designed as a tamper-resistant competitive game.

References: [PokerStars basic Hold'em rules](https://www.pokerstars.com/poker/learn/lesson/texas-holdem-rules/),
[Poker TDA betting and pot rules](https://www.pokertda.com/view-poker-tda-rules/),
[TDA short opening all-in clarification](https://www.pokertda.com/forum/index.php?topic=663.0).

## Three Card Poker

A fresh 52-card deck supplies three player and three dealer cards each hand.
Ante is required, Pair Plus is optional, and Play equals Ante. Betting reserves
the possible Play amount before dealing. The minimum wager is 20 and the hand
limit is 100,000 including reserved Play.

The dealer qualifies with queen-high or better. If unqualified, Ante pays 1:1
and Play pushes. Otherwise both pay 1:1 for a win, push for a tie, or lose.
Folding forfeits Ante and Pair Plus. After Play, Pair Plus and Ante Bonus are
paid from the player's hand independently of the dealer's result.

| Hand (descending) | Pair Plus net odds | Ante Bonus net odds |
| --- | --- | --- |
| Straight flush | 40:1 | 5:1 |
| Three of a kind | 30:1 | 4:1 |
| Straight | 6:1 | 1:1 |
| Flush | 3:1 | — |
| Pair | 1:1 | — |
| High card | — | — |

Straights rank above flushes. A23 is the lowest straight and QKA the highest.
The table above is this app's explicit paytable; casino variants may differ.
Ante Bonus is an extra payment on Ante and does not return Ante a second time.

References: [PokerStars Three Card Poker rules](https://www.pokerstars.com/casino/how-to-play/live/three-card-poker/rules/),
[Ocean Downs game guide](https://www.oceandowns.com/wp-content/uploads/2018/04/OD121708_CRD_GmngGid_3CrdPkr_4X9FNL.pdf).

## Implementation and verification

- `src/core/pokerCards.ts`: shared cards, shuffle, and hand evaluation.
- `src/core/holdem.ts`: pure immutable betting, street transitions, pots and saves.
- `src/core/holdemBot.ts`: restricted observations and local computer decisions.
- `src/core/threeCardPoker.ts`: bets, dealer qualification, payouts and saves.
- `src/ui/sands/PokerShared.tsx`: durable state updates, animation lock, cards,
  responsive viewport and common controls.
- `HoldemGame.tsx`, `ThreeCardPokerGame.tsx`, `poker.css`: game screens.
- `public/ui-test.html?design=holdem` or `?design=threecard`: visual prototypes.

Local storage keys are `sands2018.holdem.v1` and `sands2018.threecard.v1`.
Each accepted transition is saved before updating the UI. A storage failure
leaves the prior state intact. Animations only present already persisted cards
and results; reloading cannot charge or settle the same action twice. Hiding
the page completes visual playback without changing the saved ledger.

Run `npm test`, `npm run build`, and the browser checks in [e2e/README.md](e2e/README.md).
Browser checks use isolated Chromium contexts; emulated phone viewports are
not a claim of physical iOS/Safari device testing.
