import { describe, expect, it } from 'vitest';
import { isKeyFormatValid } from './client';
import { redact } from './errors';
import { fakeAqKey, fakeKey } from '../../../tests/fakeKey';

describe('Google API key formats', () => {
  it('accepts classic AIza keys and newer AQ. keys, nothing else', () => {
    expect(isKeyFormatValid(fakeKey())).toBe(true);
    expect(isKeyFormatValid(fakeAqKey())).toBe(true);
    expect(isKeyFormatValid(`  ${fakeAqKey()}  `)).toBe(true);
    expect(isKeyFormatValid('AQ.short')).toBe(false);
    expect(isKeyFormatValid('sk-' + 'x'.repeat(40))).toBe(false);
  });

  it('redacts both formats wherever they appear in an error', () => {
    const out = redact(`bad key ${fakeAqKey()} and ${fakeKey()} in one message`);
    expect(out).not.toContain(fakeAqKey());
    expect(out).not.toContain(fakeKey());
    expect(out).toContain('AQ.A••••••[redacted]');
    expect(out).toContain('AIza••••••[redacted]');
  });
});
