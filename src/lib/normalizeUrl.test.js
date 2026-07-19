import { describe, it, expect } from 'vitest';
import normalizeUrl from './normalizeUrl';

describe('normalizeUrl', () => {
  it('strips utm_* campaign params', () => {
    expect(normalizeUrl('https://ex.com/post?utm_source=nl&utm_medium=email'))
      .toBe('https://ex.com/post');
  });

  it('strips known click-id params but keeps real ones', () => {
    expect(normalizeUrl('https://ex.com/post?fbclid=abc&id=7'))
      .toBe('https://ex.com/post?id=7');
    expect(normalizeUrl('https://ex.com/p?gclid=x&ref=tw&keep=1'))
      .toBe('https://ex.com/p?keep=1');
  });

  it('is case-insensitive for param names', () => {
    expect(normalizeUrl('https://ex.com/post?UTM_Source=nl&FBCLID=x&id=7'))
      .toBe('https://ex.com/post?id=7');
  });

  it('sorts remaining params so order does not matter', () => {
    expect(normalizeUrl('https://ex.com/post?b=2&a=1'))
      .toBe(normalizeUrl('https://ex.com/post?a=1&b=2'));
    expect(normalizeUrl('https://ex.com/post?b=2&a=1'))
      .toBe('https://ex.com/post?a=1&b=2');
  });

  it('drops the fragment', () => {
    expect(normalizeUrl('https://ex.com/post#section')).toBe('https://ex.com/post');
  });

  it('trims a trailing slash on non-root paths', () => {
    expect(normalizeUrl('https://ex.com/post/')).toBe('https://ex.com/post');
  });

  it('keeps the root path slash', () => {
    expect(normalizeUrl('https://ex.com/')).toBe('https://ex.com/');
  });

  it('collapses tracking + fragment + trailing slash together', () => {
    expect(normalizeUrl('https://ex.com/post/?utm_source=nl#top'))
      .toBe('https://ex.com/post');
  });

  it('treats variants of the same page as equal', () => {
    const a = normalizeUrl('https://ex.com/article?utm_source=twitter&id=9');
    const b = normalizeUrl('https://ex.com/article?fbclid=zzz&id=9');
    expect(a).toBe(b);
  });

  it('passes non-URL strings through untouched', () => {
    expect(normalizeUrl('chrome://newtab')).toBe('chrome://newtab');
    expect(normalizeUrl('about:blank')).toBe('about:blank');
    expect(normalizeUrl('not a url')).toBe('not a url');
  });

  it('preserves values that merely contain "utm" but are not tracking keys', () => {
    expect(normalizeUrl('https://ex.com/p?album=utm_greatest'))
      .toBe('https://ex.com/p?album=utm_greatest');
  });
});
