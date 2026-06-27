import { describe, expect, it } from 'vitest';

import tsconfig from '../tsconfig/base.json' with { type: 'json' };

describe('shared TypeScript config', () => {
  it('enables strict mode', () => {
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });
});
