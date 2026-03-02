import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('Code Merlin Landing Page', () => {
  let dom;
  let document;
  let window;
  let localStorageStore = {};

  const setupDOM = (mockLocalStorage = {}, mockSystemDark = false) => {
    localStorageStore = { ...mockLocalStorage };
    
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    window = dom.window;
    document = window.document;

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => localStorageStore[key] || null),
        setItem: vi.fn((key, value) => { localStorageStore[key] = value.toString(); }),
        clear: vi.fn(() => { localStorageStore = {}; })
      },
      writable: true
    });
    
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query) => ({
        matches: query === '(prefers-color-scheme: dark)' ? mockSystemDark : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
      writable: true
    });

    // Re-run scripts manually if needed or rely on 'runScripts: dangerously'
    // In JSDOM, scripts in HEAD run before scripts in BODY
  };

  beforeEach(() => {
    setupDOM();
  });

  it('should have the correct title', () => {
    expect(document.title).toBe('Code Merlin Aplikacija');
  });

  it('should toggle theme on button click and update aria-label', () => {
    const button = document.getElementById('themeToggle');
    const docEl = document.documentElement;

    // Initial state (light)
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');

    // Click to dark
    button.click();
    expect(docEl.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na svetlu temu');

    // Click back to light
    button.click();
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');
  });

  it('should initialize with dark theme if saved in localStorage', () => {
    // We need to simulate the state BEFORE the script runs in JSDOM
    // Since JSDOM runs scripts on creation, we use a fresh instance
    const localStore = { theme: 'dark' };
    setupDOM(localStore);
    
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should fallback to system theme preference if localStorage is empty', () => {
    setupDOM({}, true); // No localStorage, but system prefers dark
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
