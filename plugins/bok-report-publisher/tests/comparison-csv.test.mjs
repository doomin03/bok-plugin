import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvText, parseCsv } from '../assets/comparison-review.mjs';

test('CSV preserves Korean, commas, multiline reviews and quotes without spreadsheet formulas', () => {
  const rows = [['id', 'review', 'score'], ['one', '차트 1개 → 2개, "추가"\n두 번째 줄', 100], ['two', '=SUM(1,2)', ''], ['three', "'원문", 'pending']];
  const encoded = csvText(rows);
  assert.ok(encoded.startsWith('\ufeff'));
  assert.ok(encoded.includes("'=SUM"));
  assert.deepEqual(parseCsv(encoded), rows.map(row => row.map(String)));
});
test('CSV parser handles CRLF and rejects malformed quoted fields', () => {
  assert.deepEqual(parseCsv('id,review\r\na,"hello"\r\n'), [['id', 'review'], ['a', 'hello']]);
  assert.throws(() => parseCsv('a,"unfinished'), /닫히지/);
  assert.throws(() => parseCsv('a,"closed"junk'), /잘못/);
});
