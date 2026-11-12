import assert from 'node:assert/strict';
import { test } from 'node:test';

// Loaded by URL so plain node can run this file: node --experimental-strip-types --test <file>
const tz = (await import(new URL('./user-timezone.ts', import.meta.url).href)) as typeof import('./user-timezone');

// 22:30 UTC on 13 Nov is already 14 Nov in Nairobi (UTC+3).
const LATE_UTC = '2026-11-13T22:30:00Z';

test('user zone, then tenant zone, then Africa/Nairobi', () => {
  assert.equal(tz.resolveTimeZone({ profile: { timezone: 'Africa/Lagos' } }, { timezone: 'Europe/London' }), 'Africa/Lagos');
  assert.equal(tz.resolveTimeZone({ profile: { timezone: 'Mars/Olympus' } }, { timezone: 'Europe/London' }), 'Europe/London');
  assert.equal(tz.resolveTimeZone(null, null), 'Africa/Nairobi');
});

test('formatters follow the active zone set from /me', () => {
  tz.applyUserTimeZone({ profile: { timezone: 'America/New_York' } }, { timezone: 'Africa/Nairobi' });
  assert.equal(tz.formatDate(LATE_UTC), '13 Nov 2026');
  assert.equal(tz.formatTime(LATE_UTC), '17:30');
  tz.setActiveTimeZone('Africa/Nairobi');
  assert.equal(tz.formatDate(LATE_UTC), '14 Nov 2026');
  assert.equal(tz.formatTime(LATE_UTC), '01:30');
});

test('an explicit zone wins and a calendar day never shifts', () => {
  assert.equal(tz.formatDate(LATE_UTC, 'Europe/London'), '13 Nov 2026');
  assert.equal(tz.formatDate('2026-11-20', 'America/New_York'), '20 Nov 2026');
});

test('empty and unparseable input', () => {
  assert.equal(tz.formatDateTime(null), '');
  assert.equal(tz.formatDateTime('pending'), 'pending');
});
