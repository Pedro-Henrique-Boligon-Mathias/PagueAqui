import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import baseConfig from '../../packages/config/eslint/base.mjs';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [...baseConfig, ...compat.extends('next/core-web-vitals', 'next/typescript')];

export default config;
