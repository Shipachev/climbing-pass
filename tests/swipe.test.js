import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swipeStatus } from '../js/swipe.js';
test('свайпы: направления, порог, короткое касание и вертикальная прокрутка', () => {
  assert.equal(swipeStatus(100, 8, 320), 'done');
  assert.equal(swipeStatus(-100, 8, 320), 'skipped');
  assert.equal(swipeStatus(20, 0, 320), null);
  assert.equal(swipeStatus(100, 140, 320), null);
  assert.equal(swipeStatus(-100, -140, 320), null);
  assert.equal(swipeStatus(60, 0, 220), null);
  assert.equal(swipeStatus(89, 0, 390), null);
  assert.equal(swipeStatus(90, 0, 390), 'done');
});
