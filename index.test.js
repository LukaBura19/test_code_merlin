import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('Code Merlin Landing Page', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    window = dom.window;
    document = window.document;

    // Mock localStorage
    const localStorageMock = (() => {
      let store = {};
      return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        clear: () => { store = {}; }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
      }),
    });
  });

  it('should have the correct title', () => {
    expect(document.title).toBe('Code Merlin Aplikacija');
  });

  it('should toggle theme on button click', () => {
    const button = document.getElementById('themeToggle');
    const docEl = document.documentElement;

    // Initial state (light)
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');

    // Click to dark
    button.click();
    expect(docEl.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');

    // Click back to light
    button.click();
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('should have accessibility aria-label on toggle button', () => {
    const button = document.getElementById('themeToggle');
    expect(button.getAttribute('aria-label')).toBeDefined();
  });
});
