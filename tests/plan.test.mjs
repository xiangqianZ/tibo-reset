import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, createPlan, getCalendarCells, getProgress, getShanghaiDate, getStatus, parseDate } from '../src/plan-model.ts';

const content = Array.from({ length: 28 }, () => ({ category: null, title: '待核实', summary: '', changes: [], publicationStatus: 'unverified', sources: [] }));

test('28 days remain consecutive across month and year boundaries', () => {
  const days = createPlan('2026-12-20', content);
  assert.equal(days.length, 28);
  assert.equal(days[0].date, '2026-12-20');
  assert.equal(days[12].date, '2027-01-01');
  assert.equal(days[27].date, '2027-01-16');
  assert.deepEqual(days.map((day) => day.day), Array.from({ length: 28 }, (_, index) => index + 1));
});

test('date arithmetic respects leap years', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-02-28', 2), '2028-03-01');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
});

test('invalid dates and incomplete plans fail explicitly', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-2-01', 'not-a-date']) assert.throws(() => parseDate(date), /Invalid date/);
  assert.throws(() => createPlan('2026-10-05', content.slice(1)), /exactly 28/);
});

test('progress is bounded before, during and after the plan', () => {
  const days = createPlan('2026-10-05', content);
  assert.deepEqual(getProgress(days, '2026-10-04'), { elapsed: 0, total: 28, percent: 0 });
  assert.deepEqual(getProgress(days, '2026-10-16'), { elapsed: 12, total: 28, percent: 43 });
  assert.deepEqual(getProgress(days, '2026-11-01'), { elapsed: 28, total: 28, percent: 100 });
  assert.deepEqual(getProgress(days, '2027-01-01'), { elapsed: 28, total: 28, percent: 100 });
});

test('upcoming days are distinct from today and completed days', () => {
  assert.equal(getStatus('2026-10-15', '2026-10-16', 'published'), 'completed');
  assert.equal(getStatus('2026-10-16', '2026-10-16', 'published'), 'today');
  assert.equal(getStatus('2026-10-17', '2026-10-16', 'scheduled'), 'upcoming');
});

test('calendar aligns dates with a Monday start without losing a day', () => {
  assert.equal(getCalendarCells(createPlan('2026-10-05', content)).length, 28);
  const cells = getCalendarCells(createPlan('2026-10-08', content));
  assert.equal(cells.length, 35);
  assert.deepEqual(cells.slice(0, 3), [null, null, null]);
  assert.equal(cells[3].date, '2026-10-08');
  assert.equal(cells[30].day, 28);
  assert.equal(cells.filter(Boolean).length, 28);
  assert.deepEqual(getCalendarCells([]), []);
});

test('formal mode uses the Chinese date at UTC midnight boundaries', () => {
  assert.equal(getShanghaiDate(new Date('2026-10-15T15:59:59Z')), '2026-10-15');
  assert.equal(getShanghaiDate(new Date('2026-10-15T16:00:00Z')), '2026-10-16');
});

test('an unverified date never becomes a published announcement just because time passes', () => {
  assert.equal(getStatus(null, '2026-10-16'), 'unverified');
  assert.equal(getStatus('2026-10-05', '2026-10-16'), 'unverified');
  assert.equal(getStatus('2026-10-05', '2026-10-16', 'unverified'), 'unverified');
  assert.equal(getStatus('2026-10-05', '2026-10-16', 'scheduled'), 'upcoming');
});

test('an unknown start date does not produce invented dates or weekday alignment', () => {
  const days = createPlan(null, content);
  assert.equal(days.filter((day) => day.date === null).length, 28);
  assert.equal(getCalendarCells(days).length, 28);
  assert.deepEqual(getProgress(days, '2026-10-16'), { elapsed: 0, total: 28, percent: 0 });
});

test('published and scheduled entries require original sources and publication dates', () => {
  const entry = { ...content[0], category: 'reset', publicationStatus: 'published' };
  assert.throws(() => createPlan('2026-10-05', [entry, ...content.slice(1)]), /original sources/);
  const invalidSource = { url: 'http://example.com/post', publishedAt: '2026-10-05', title: 'Source' };
  assert.throws(() => createPlan('2026-10-05', [{ ...entry, sources: [invalidSource] }, ...content.slice(1)]), /HTTPS/);
  const source = { ...invalidSource, url: 'https://example.com/post', publishedAt: '' };
  assert.throws(() => createPlan('2026-10-05', [{ ...entry, sources: [source] }, ...content.slice(1)]), /publication date/);
  const verified = { ...entry, sources: [{ ...source, publishedAt: '2026-10-05T09:00:00Z' }] };
  assert.equal(createPlan('2026-10-05', [verified, ...content.slice(1)])[0].publicationStatus, 'published');
});
