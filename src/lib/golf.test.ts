// Checks the maths against a real scorecard: Lambourne Orange tees, 15 Nov 2026,
// playing handicap 6. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scorecard, shotsReceived, type HoleEntry } from "./golf.ts";
import { LAMBOURNE_ORANGE } from "./seed.ts";

const scores = [5, 7, 4, 5, 3, 5, 4, 5, 4, 5, 4, 5, 3, 5, 4, 5, 3, 5];
const putts = [1, 3, 2, 2, 2, 2, 3, 2, 2, 1, 1, 2, 2, 2, 1, 2, 2, 2];
const fir = [1, 0, 1, 0, null, 1, null, 0, 1, 0, 0, 1, null, 1, 0, 1, null, 0];

const entries: HoleEntry[] = scores.map((score, i) => ({
  score,
  putts: putts[i],
  fairway: fir[i] === null ? null : fir[i] ? "hit" : "left",
  penalties: null,
  bunker: false,
  chips: null,
}));

test("matches the 15 Nov scorecard", () => {
  const card = scorecard(LAMBOURNE_ORANGE, entries, 6);
  assert.deepEqual(
    card.rows.map((r) => r.points),
    [1, 0, 3, 2, 2, 2, 1, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 1],
  );
  assert.equal(card.out.gross, 42);
  assert.equal(card.out.net, 39);
  assert.equal(card.out.points, 15);
  assert.equal(card.in.gross, 39);
  assert.equal(card.in.net, 36);
  assert.equal(card.in.points, 18);
  assert.equal(card.total.gross, 81);
  assert.equal(card.total.net, 75);
  assert.equal(card.total.points, 33);
  assert.equal(card.total.putts, 34);
  assert.equal(card.total.yards, 6575);
  assert.equal(card.total.par, 72);
  assert.deepEqual([card.total.firHit, card.total.firOf], [7, 14]);
  assert.deepEqual([card.total.girHit, card.total.girOf], [9, 18]);
  assert.deepEqual([card.total.scrambleMade, card.total.scrambleOf], [2, 9]);
  assert.deepEqual([card.out.firHit, card.out.firOf], [4, 7]);
  assert.deepEqual([card.out.girHit, card.out.girOf], [5, 9]);
});

test("handicap strokes", () => {
  assert.equal(shotsReceived(6, 6), 1);
  assert.equal(shotsReceived(6, 7), 0);
  assert.equal(shotsReceived(20, 2), 2);
  assert.equal(shotsReceived(20, 3), 1);
  assert.equal(shotsReceived(-2, 17), -1);
  assert.equal(shotsReceived(-2, 16), 0);
});
