import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('Code Merlin SCRUM-9/SCRUM-10: User Profile Greeting and Info Banner', () => {
  let dom;
  let document;
  let window;
  let localStorageStore = {};

  const setupDOM = (mockLocalStorage = {}) => {
    localStorageStore = { ...mockLocalStorage };
    
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    window = dom.window;
    document = window.document;

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => localStorageStore[key] || null),
        setItem: vi.fn((key, value) => { localStorageStore[key] = value.toString(); }),
        removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
        clear: vi.fn(() => { localStorageStore = {}; })
      },
      writable: true
    });
  };

  beforeEach(() => {
    setupDOM();
  });

  it('should display personalized greeting if name is saved in localStorage', () => {
    setupDOM({ username: 'Marko' });
    const greeting = document.getElementById('greeting');
    expect(greeting.textContent).toBe('Dobrodošli, Marko!');
  });

  it('should update greeting and localStorage when saving a valid name', () => {
    const nameInput = document.getElementById('nameInput');
    const saveBtn = document.getElementById('saveBtn');
    const greeting = document.getElementById('greeting');

    nameInput.value = 'Ana';
    saveBtn.click();

    expect(greeting.textContent).toBe('Dobrodošli, Ana!');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('username', 'Ana');
  });

  it('should handle exactly 20 characters as valid input', () => {
    const nameInput = document.getElementById('nameInput');
    const saveBtn = document.getElementById('saveBtn');
    const greeting = document.getElementById('greeting');
    const errorMsg = document.getElementById('errorMsg');

    const longName = 'A'.repeat(20);
    nameInput.value = longName;
    saveBtn.click();

    expect(errorMsg.textContent).toBe('');
    expect(greeting.textContent).toBe(`Dobrodošli, ${longName}!`);
  });

  it('should clear error message after a successful save', () => {
    const nameInput = document.getElementById('nameInput');
    const saveBtn = document.getElementById('saveBtn');
    const errorMsg = document.getElementById('errorMsg');

    // Trigger error
    nameInput.value = '';
    saveBtn.click();
    expect(errorMsg.textContent).not.toBe('');

    // Successful save
    nameInput.value = 'Validno Ime';
    saveBtn.click();
    expect(errorMsg.textContent).toBe('');
  });

  it('should handle HTML tags as literal text (XSS Protection)', () => {
    const nameInput = document.getElementById('nameInput');
    const saveBtn = document.getElementById('saveBtn');
    const greeting = document.getElementById('greeting');

    const xssPayload = '<img src=x onerror=alert(1)>';
    nameInput.value = xssPayload;
    saveBtn.click();

    // Should display the literal string, not execute it
    expect(greeting.textContent).toBe(`Dobrodošli, ${xssPayload}!`);
  });

  it('should reset name and greeting when clicking reset button', () => {
    setupDOM({ username: 'Luka' });
    const resetBtn = document.getElementById('resetBtn');
    const greeting = document.getElementById('greeting');
    const nameInput = document.getElementById('nameInput');

    resetBtn.click();

    expect(greeting.textContent).toBe('Dobrodošli na Code Merlin aplikaciju');
    expect(nameInput.value).toBe('');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('username');
  });

  // --- SCRUM-10: Info banner tests ---

  it('should show info banner by default when not dismissed', () => {
    const banner = document.getElementById('infoBanner');
    expect(banner).not.toBeNull();
  });

  it('should hide info banner and set localStorage when close button is clicked', () => {
    const banner = document.getElementById('infoBanner');
    const closeBtn = document.getElementById('bannerCloseBtn');

    expect(banner.style.display).not.toBe('none');
    closeBtn.click();

    expect(banner.style.display).toBe('none');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('bannerDismissed', 'true');
  });

  it('should initialize with banner dismissed when bannerDismissed is true in storage', () => {
    setupDOM({ bannerDismissed: 'true' });
    const banner = document.getElementById('infoBanner');

    // Element exists in DOM but should be effectively hidden by class
    expect(banner).not.toBeNull();
    expect(document.documentElement.classList.contains('banner-dismissed')).toBe(true);
  });
});
