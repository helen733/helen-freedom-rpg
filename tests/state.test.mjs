import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, stats, setTaskDone, advanceDay, validateState } from '../dist/state.js';

test('starts at level 1 and stores independent days', () => {
  const s = createState();
  assert.equal(stats(s).level, 1);
  assert.equal(stats(s).totalXp, 0);
  s.days[0][0].text = '验证一个需求';
  assert.notEqual(s.days[1][0].text, '验证一个需求');
});
test('completion grants XP once, undo removes XP, five tasks level up', () => {
  const s = createState();
  for (let i = 0; i < 5; i++) {
    const d = Math.floor(i / 3), t = i % 3;
    s.days[d][t].text = '真实行动';
    setTaskDone(s, d, t, true);
    setTaskDone(s, d, t, true);
  }
  assert.equal(stats(s).totalXp, 100);
  assert.equal(stats(s).level, 2);
  setTaskDone(s, 0, 0, false);
  assert.equal(stats(s).totalXp, 80);
});
test('empty tasks cannot earn XP and unfinished days cannot advance', () => {
  const s = createState();
  s.days[0][0].text = ' ';
  assert.equal(setTaskDone(s, 0, 0, true), false);
  assert.equal(advanceDay(s), false);
  for (const t of s.days[0]) { t.text = '完成验证'; t.done = true; }
  assert.equal(advanceDay(s), true);
  assert.equal(s.currentDay, 1);
});
test('chest unlocks only after all 21 tasks, challenge stops at day 7', () => {
  const s = createState();
  for (let d = 0; d < 7; d++) {
    assert.equal(stats(s).canClaim, false);
    for (const t of s.days[d]) { t.text = '已行动'; t.done = true; }
    if (d < 6) assert.equal(advanceDay(s), true);
  }
  assert.equal(stats(s).canClaim, true);
  assert.equal(stats(s).completedDays, 7);
  assert.equal(advanceDay(s), false);
  s.rewardClaimed = true;
  assert.equal(stats(s).canClaim, false);
});
test('saved data round trips, corrupt and unsupported data are rejected', () => {
  const s = createState();
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))), s);
  for (const bad of [null, {}, {...s, version: 99}, {...s, currentDay: 9}, {...s, days: []}]) {
    assert.throws(() => validateState(bad));
  }
  s.days[0][0] = { text: '', done: true };
  assert.throws(() => validateState(s));
});
