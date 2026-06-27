import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('home page', () => {
  it('renders the app name', () => {
    expect(renderToStaticMarkup(createElement(HomePage))).toContain('Leitor NFC-e');
  });
});
