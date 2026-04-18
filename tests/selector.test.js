import { describe, it, expect } from 'vitest';
import { buildCatalog } from '../src/core/selector.js';

describe('buildCatalog', () => {
  it('computes key from persona name', () => {
    const catalog = buildCatalog([
      { name: 'The First Principles Thinker', behavior: 'test', focus: [], stops_when: '' },
    ]);
    expect(catalog['first-principles-thinker']).toBeDefined();
    expect(catalog['first-principles-thinker'].name).toBe('The First Principles Thinker');
  });

  it('strips "The " prefix from key', () => {
    const catalog = buildCatalog([
      { name: 'The Skeptic', behavior: 'test', focus: [], stops_when: '' },
    ]);
    expect(catalog['skeptic']).toBeDefined();
    expect(catalog['the-skeptic']).toBeUndefined();
  });

  it('handles persona without "The" prefix', () => {
    const catalog = buildCatalog([
      { name: 'Arc Reader', behavior: 'test', focus: [], stops_when: '' },
    ]);
    expect(catalog['arc-reader']).toBeDefined();
  });

  it('builds catalog for all dynamic personas', () => {
    const personas = [
      { name: 'The Contrarian', behavior: '', focus: [], stops_when: '' },
      { name: 'The Domain Outsider', behavior: '', focus: [], stops_when: '' },
      { name: 'The First Principles Thinker', behavior: '', focus: [], stops_when: '' },
    ];
    const catalog = buildCatalog(personas);
    expect(Object.keys(catalog)).toEqual(['contrarian', 'domain-outsider', 'first-principles-thinker']);
  });
});
