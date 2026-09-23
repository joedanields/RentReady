/**
 * Builds a fake, key-shaped string at runtime. The prefix is split so no key-shaped literal
 * ever appears in source — CI's `git grep 'AIza…'` secret scan must stay clean.
 */
export function fakeKey(body = 'SyFakeKeyForTestsOnly0123456789ab'): string {
  return ['AI', 'za', body].join('');
}
