import { describe, it, expect } from 'vitest';
import { redact, createAppError, mapHttpError, ERROR_MESSAGES } from './errors';
import { fakeKey } from '../../../tests/fakeKey';

describe('redact', () => {
  it('redacts AIza keys', () => {
    const out = redact(`key=${fakeKey('SyDzx7hJxJxJxJxJxJxJxJxJxJxJxJxJx')} say hi`);
    expect(out).toContain('AIza••••••[redacted]');
    expect(out).not.toContain('AIzaSy');
  });

  it('redacts generic key=value and Bearer tokens', () => {
    expect(redact('api_key=abcdef1234567890')).toContain('api_key=[redacted]');
    expect(redact('API Key: supersecretvaluezzz')).toContain('API Key=[redacted]');
    expect(redact('Authorization: Bearer abc.DEF123')).toContain('Bearer [redacted]');
  });

  it('leaves plain text untouched', () => {
    const msg = 'No secrets in here.';
    expect(redact(msg)).toBe(msg);
  });
});

describe('createAppError', () => {
  it('builds a typed error with retryability', () => {
    const err = createAppError('NO_KEY');
    expect(err.code).toBe('NO_KEY');
    expect(err.retryable).toBe(true);
    expect(err.message).toContain('No API key set');
  });

  it('keeps redacted details apart from the user-facing message', () => {
    const err = createAppError(
      'KEY_REJECTED',
      `rejected key ${fakeKey('SyBadKeyValue1234567890zz')}`
    );
    expect(err.details).toBe('rejected key AIza••••••[redacted]');
    expect(err.message).not.toContain('rejected key');
  });
});

describe('mapHttpError', () => {
  it('tells a quota error apart from a rate limit on 429', () => {
    expect(mapHttpError(429, '{"error":{"message":"You exceeded your current quota"}}').code).toBe(
      'QUOTA'
    );
    expect(mapHttpError(429, 'Too many requests').code).toBe('RATE_LIMITED');
  });

  it('maps auth statuses to KEY_REJECTED', () => {
    for (const s of [400, 401, 403]) {
      expect(mapHttpError(s, 'nope').code).toBe('KEY_REJECTED');
    }
  });

  it('maps 429 to RATE_LIMITED, 404 to MODEL_UNAVAILABLE and 5xx to SERVICE_BUSY', () => {
    expect(mapHttpError(404, 'model retired').code).toBe('MODEL_UNAVAILABLE');
    expect(mapHttpError(429, 'slow down').code).toBe('RATE_LIMITED');
    for (const s of [500, 502, 503]) {
      expect(mapHttpError(s, 'boom').code).toBe('SERVICE_BUSY');
    }
  });

  it('falls back to UNKNOWN', () => {
    expect(mapHttpError(418, 'teapot').code).toBe('UNKNOWN');
  });
});

describe('ERROR_MESSAGES', () => {
  it('covers every code with a message', () => {
    for (const [code, meta] of Object.entries(ERROR_MESSAGES)) {
      expect(code.length).toBeGreaterThan(0);
      expect(meta.message.length).toBeGreaterThan(0);
      expect(typeof meta.retryable).toBe('boolean');
    }
  });
});
