import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeKey } from '../../../tests/fakeKey';
import { generateContent, repairJson, isKeyFormatValid, redact } from './client';

type FetchMock = ReturnType<typeof vi.fn>;

const OK_ENVELOPE = JSON.stringify({
  candidates: [{ content: { parts: [{ text: '\n  {"result":"ok"}\n' }] } }],
});

const textResponse = (body: string, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as unknown as Response;

const params = {
  model: 'gemini-2.5-flash',
  apiKey: 'AIzaTestKeyOnlyForTests',
  system: 'sys',
  userPrompt: 'prompt',
  temperature: 0,
  maxOutputTokens: 1000,
  timeoutMs: 5000,
};

function lastFetchCall(fetch: FetchMock) {
  const [url, init] = fetch.mock.calls[fetch.mock.calls.length - 1]! as [
    string,
    RequestInit & { body: string },
  ];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('generateContent', () => {
  it('posts to generateContent with x-goog-api-key and returns trimmed text', async () => {
    const fetch = vi.fn().mockResolvedValue(textResponse(OK_ENVELOPE));
    vi.stubGlobal('fetch', fetch);

    const out = await generateContent(params);
    expect(out).toEqual({ text: '{"result":"ok"}', aborted: false });

    const call = lastFetchCall(fetch);
    expect(call.url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(call.headers['x-goog-api-key']).toBe(params.apiKey);
    expect(call.headers['Content-Type']).toBe('application/json');
    expect(call.body.contents[0].parts[0].text).toBe('prompt');
    expect(call.body.generationConfig.responseMimeType).toBeUndefined();
  });

  it('adds responseMimeType and schema when a responseSchema is supplied', async () => {
    const fetch = vi.fn().mockResolvedValue(textResponse(OK_ENVELOPE));
    vi.stubGlobal('fetch', fetch);

    await generateContent({ ...params, responseSchema: { type: 'OBJECT' } });
    const call = lastFetchCall(fetch);
    expect(call.body.generationConfig.responseMimeType).toBe('application/json');
    expect(call.body.generationConfig.responseSchema).toEqual({ type: 'OBJECT' });
  });

  it('joins multiple parts into one text', async () => {
    const envelope = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }, { text: '' }] } }],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse(envelope)));
    const out = await generateContent(params);
    expect(out.text).toBe('ab');
  });

  it('returns empty text when the body is not JSON at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse('<html>oops</html>')));
    const out = await generateContent(params);
    expect(out).toEqual({ text: '', aborted: false });
  });

  it('keeps raw JSON bodies for the repair pass', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse('{"candidates":[]}')));
    const out = await generateContent(params);
    expect(out.text).toBe('{"candidates":[]}');
  });

  it('maps 401 to KEY_REJECTED with redacted details', async () => {
    const fetch = vi.fn().mockResolvedValue(textResponse('bad key AIzaSyBadKeyValue12345x', 401));
    vi.stubGlobal('fetch', fetch);

    await expect(generateContent(params)).rejects.toMatchObject({
      code: 'KEY_REJECTED',
      retryable: true,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 once and succeeds on the next attempt', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse('rate limited', 429))
      .mockResolvedValueOnce(textResponse(OK_ENVELOPE));
    vi.stubGlobal('fetch', fetch);

    const out = await generateContent({ ...params, timeoutMs: 5000 });
    expect(out.text).toBe('{"result":"ok"}');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausted retries on a 5xx', async () => {
    const fetch = vi.fn().mockResolvedValue(textResponse('boom', 503));
    vi.stubGlobal('fetch', fetch);

    await expect(generateContent(params)).rejects.toMatchObject({ code: 'SERVICE_BUSY' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('aborts and reports a timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_: string, init: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;
            const rejectAbort = () =>
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            if (signal?.aborted) {
              rejectAbort();
              return;
            }
            signal?.addEventListener('abort', rejectAbort);
          })
      )
    );

    const pending = generateContent({ ...params, timeoutMs: 50 });
    const settled = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(5000);
    await settled;
  });
});

describe('repairJson', () => {
  it('strips markdown fences and stray prose', () => {
    expect(repairJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(repairJson('Here is the result: {"a": {"b": 2}} — done')).toBe('{"a": {"b": 2}}');
  });

  it('returns trimmed input when no JSON object exists', () => {
    expect(repairJson('  Nothing here  ')).toBe('Nothing here');
  });
});

describe('isKeyFormatValid', () => {
  it('accepts AIza keys of sufficient length only', () => {
    expect(isKeyFormatValid(fakeKey('SyDzxB741z5H8k7w6Qx2pPk3nF9yRtUvWm'))).toBe(true);
    expect(isKeyFormatValid('nope')).toBe(false);
    expect(isKeyFormatValid('AIzaShort')).toBe(false);
  });
});

describe('redact re-export', () => {
  it('is the same function used by the error path', () => {
    expect(typeof redact).toBe('function');
    expect(redact(fakeKey('SyDzxB741z5H8k7w6Qx2pPk3nF9yRtUvWm'))).toContain('[redacted]');
  });
});
