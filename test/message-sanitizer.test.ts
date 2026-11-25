import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeMessage } from '../src/services/message-sanitizer.service.ts';

test('redacts emails with tags, subdomains, and punctuation around them', () => {
  const message = 'Email <A.User+tag@support.example.com>, or write to ops@example.org.';

  assert.equal(sanitizeMessage(message), 'Email <<REDACTED: EMAIL>>, or write to <REDACTED: EMAIL>.');
});

test('redacts card candidates with or without separators across the supported lengths', () => {
  const message = '4111111111111111, 4111  1111 1111 1111; 3782-822463-10005; ' +
    '12345678-1234; 1234-5678 9012-3456 789';

  assert.equal(
    sanitizeMessage(message),
    '<REDACTED: CREDIT_CARD>, <REDACTED: CREDIT_CARD>; <REDACTED: CREDIT_CARD>; ' +
    '<REDACTED: CREDIT_CARD>; <REDACTED: CREDIT_CARD>',
  );
});

test('redacts card-shaped numbers with an invalid Luhn checksum', () => {
  assert.equal(sanitizeMessage('Card: 4111111111111112.'), 'Card: <REDACTED: CREDIT_CARD>.');
});

test('redacts compact and hyphenated SSNs without checking issuance rules', () => {
  assert.equal(
    sanitizeMessage('SSNs: 000-00-0000 and 123456789.'),
    'SSNs: <REDACTED: SSN> and <REDACTED: SSN>.',
  );
});

test('redacts mixed and adjacent values while retaining the original and surrounding text', () => {
  const original = '123456789@example.com: 3782 822463 10005 4111 1111 1111 1111 123-45-6789 123456789.';
  const sanitized = sanitizeMessage(original);

  assert.equal(
    sanitized,
    '<REDACTED: EMAIL>: <REDACTED: CREDIT_CARD> <REDACTED: CREDIT_CARD> <REDACTED: SSN> <REDACTED: SSN>.',
  );
  assert.equal(original, '123456789@example.com: 3782 822463 10005 4111 1111 1111 1111 123-45-6789 123456789.');
  assert.equal(sanitizeMessage(sanitized), sanitized);
});

test('leaves malformed emails, incomplete numbers, and overlong contiguous IDs intact', () => {
  const message = 'first..last@example.com, first@@example.com, first@example, first@-example.com, ' +
    'first@example.com_bad, 12-345-6789, 1234567890, 12345678901234567890, 4111--1111--1111--1111.';

  assert.equal(sanitizeMessage(message), message);
});

test('leaves empty strings and messages with no sensitive values intact', () => {
  assert.equal(sanitizeMessage(''), '');
  assert.equal(sanitizeMessage('Order #42 arrives on 2026-11-25.'), 'Order #42 arrives on 2026-11-25.');
});

test('handles long near-matches and long numeric chains', () => {
  const nearMatches = `${'a'.repeat(200_000)}@example.com ${'1'.repeat(200_000)}`;
  const cards = '4111 1111 1111 1111';

  assert.equal(sanitizeMessage(`${nearMatches}; user@example.com`), `${nearMatches}; <REDACTED: EMAIL>`);
  assert.equal(sanitizeMessage(Array(4_000).fill(cards).join(' ')), Array(4_000).fill('<REDACTED: CREDIT_CARD>').join(' '));
});
