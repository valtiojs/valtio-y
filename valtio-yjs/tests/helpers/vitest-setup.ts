import '@testing-library/jest-dom/vitest';
// Enable detailed internal tracing when VY_TRACE=1
try {
  if (typeof process !== 'undefined' && process.env && process.env.VY_TRACE === '1') {
    (globalThis as unknown as { __VY_TRACE__?: boolean }).__VY_TRACE__ = true;
  }
} catch {
  // Silently ignore errors in environment detection
}
