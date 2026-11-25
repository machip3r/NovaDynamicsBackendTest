const EMAIL = '<REDACTED: EMAIL>';
const CREDIT_CARD = '<REDACTED: CREDIT_CARD>';
const SSN = '<REDACTED: SSN>';

// The left boundary prevents retries inside a long local part. Domain labels are
// bounded and separated by literal dots, so there is one way to split the labels.
const emailPattern = /(?<![\p{L}\p{M}\p{N}.!#$%&'*+\/=?^_`{|}~@-])([A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]{1,64})@((?:[A-Za-z0-9-]{1,63}\.){1,126}[A-Za-z0-9-]{1,63})(?![\p{L}\p{M}\p{N}_@-]|\.[\p{L}\p{M}\p{N}._-])/gu;
// Digits and separators are disjoint, so each group boundary is unambiguous.
const numericChainPattern = /\d+(?:(?: +|-)\d+)*/g;
const minCardDigits = 12;
const maxCardDigits = 19;
const standardCardGroupings = new Set(['4-4-4-4', '4-4-4-4-3', '4-6-5', '4-6-4']);

type NumericMatch = {
  endGroup: number;
  replacement: typeof CREDIT_CARD | typeof SSN;
};

type RedactionPlan = {
  coveredDigits: number;
  standardMatches: number;
  match?: NumericMatch;
};

function redactEmail(candidate: string, local: string, domain: string): string {
  const labels = domain.split('.');
  const suffix = labels[labels.length - 1];

  if (
    candidate.length > 254 || local.startsWith('.') || local.endsWith('.') || local.includes('..') ||
    labels.some((label) => label.startsWith('-') || label.endsWith('-')) ||
    !/^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i.test(suffix)
  ) {
    return candidate;
  }

  return EMAIL;
}

function redactNumericChain(chain: string): string {
  // Keep whole digit groups so a longer identifier never matches by substring.
  const groups = Array.from(chain.matchAll(/\d+/g), ({ 0: digits, index }) => ({
    start: index,
    end: index + digits.length,
    length: digits.length,
  }));
  const plans: RedactionPlan[] = new Array(groups.length + 1);
  plans[groups.length] = { coveredDigits: 0, standardMatches: 0 };

  // Find the split that redacts the most digits. Prefer standard formats when
  // equally complete splits would classify neighboring values differently.
  for (let first = groups.length - 1; first >= 0; first--) {
    const { coveredDigits, standardMatches } = plans[first + 1];
    let best: RedactionPlan = { coveredDigits, standardMatches };
    let digitCount = 0;
    const groupLengths: number[] = [];

    for (let last = first; last < groups.length; last++) {
      const group = groups[last];
      digitCount += group.length;
      if (digitCount > maxCardDigits) break;
      groupLengths.push(group.length);
      if (digitCount !== 9 && digitCount < minCardDigits) continue;

      const grouping = groupLengths.join('-');
      const isSsn = grouping === '9' || (
        grouping === '3-2-4' && chain[groups[first].end] === '-' && chain[groups[first + 1].end] === '-'
      );
      if (!isSsn && digitCount < minCardDigits) continue;

      const remainder = plans[last + 1];
      const isStandard = isSsn || first === last || standardCardGroupings.has(grouping);
      const coverage = digitCount + remainder.coveredDigits;
      const standardCount = Number(isStandard) + remainder.standardMatches;
      if (coverage > best.coveredDigits || (coverage === best.coveredDigits && standardCount > best.standardMatches)) {
        best = {
          coveredDigits: coverage,
          standardMatches: standardCount,
          match: { endGroup: last, replacement: isSsn ? SSN : CREDIT_CARD },
        };
      }
    }

    plans[first] = best;
  }

  if (plans[0].coveredDigits === 0) return chain;

  const parts: string[] = [];
  let cursor = 0;
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const match = plans[groupIndex].match;
    if (!match) continue;

    parts.push(chain.slice(cursor, groups[groupIndex].start), match.replacement);
    groupIndex = match.endGroup;
    cursor = groups[groupIndex].end;
  }

  parts.push(chain.slice(cursor));
  return parts.join('');
}

export function sanitizeMessage(message: string): string {
  return message.replace(emailPattern, redactEmail).replace(numericChainPattern, redactNumericChain);
}
