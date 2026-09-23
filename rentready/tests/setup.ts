/** Vitest setup: jest-dom matchers, DOM cleanup, and gaps in jsdom that real browsers don't have. */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// jsdom's Blob has no arrayBuffer() (every browser RentReady supports does); intake reads the
// first bytes of a file with it to sniff the real file type.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  window.location.hash = '';
});
