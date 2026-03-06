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

  const setupDOM = (mockLocalStorage = {}, mockSystemDark = false, setItemThrows = false) => {
    localStorageStore = { ...mockLocalStorage };

    const setItemImpl = setItemThrows
      ? vi.fn(() => { throw new Error('QuotaExceededError'); })
      : vi.fn((key, value) => { localStorageStore[key] = value.toString(); });

    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
      beforeParse: (win) => {
        Object.defineProperty(win, 'localStorage', {
          value: {
            getItem: vi.fn((key) => localStorageStore[key] || null),
            setItem: setItemImpl,
            clear: vi.fn(() => { localStorageStore = {}; })
          },
          writable: true
        });
        Object.defineProperty(win, 'matchMedia', {
          value: vi.fn((query) => ({
            matches: query === '(prefers-color-scheme: dark)' ? mockSystemDark : false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
          })),
          writable: true
        });
      }
    });
    window = dom.window;
    document = window.document;
  };

  beforeEach(() => {
    setupDOM();
  });

  it('should have the correct title', () => {
    expect(document.title).toBe('Code Merlin Aplikacija');
  });

  it('should toggle theme on button click and update aria-label and visible text', () => {
    const button = document.getElementById('themeToggle');
    const docEl = document.documentElement;

    // Initial state (light)
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');
    expect(button.textContent).toBe('Prebaci na tamnu temu');

    // Click to dark
    button.click();
    expect(docEl.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na svetlu temu');
    expect(button.textContent).toBe('Prebaci na svetlu temu');

    // Click back to light
    button.click();
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');
    expect(button.textContent).toBe('Prebaci na tamnu temu');
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

  it('should show fallback message when localStorage.setItem throws (e.g. private mode)', () => {
    setupDOM({}, false, true); // setItemThrows = true

    const button = document.getElementById('themeToggle');
    const storageMessage = document.getElementById('storageMessage');

    expect(storageMessage.classList.contains('hidden')).toBe(true);

    button.click();

    expect(storageMessage.classList.contains('hidden')).toBe(false);
    expect(storageMessage.textContent).toContain("Ne možemo da sačuvamo temu na ovom uređaju");
  });

  it('should show initial name character counter as 0/20', () => {
    const nameCounter = document.getElementById('nameCounter');
    expect(nameCounter.textContent).toBe('0/20 characters');
  });

  it('should update character counter as the user types', () => {
    const nameInput = document.getElementById('nameInput');
    const nameCounter = document.getElementById('nameCounter');

    nameInput.value = 'Test';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(nameCounter.textContent).toBe('4/20 characters');
  });

  it('should apply warning class when length is between 18 and 20', () => {
    const nameInput = document.getElementById('nameInput');
    const nameCounter = document.getElementById('nameCounter');

    nameInput.value = 'a'.repeat(19);
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(nameCounter.classList.contains('warning')).toBe(true);

    nameInput.value = 'a'.repeat(20);
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(nameCounter.classList.contains('warning')).toBe(true);
  });

  describe('SCRUM-16: Save button validation', () => {
    it('should have saveBtn disabled initially when input is empty', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');
      expect(nameInput.value).toBe('');
      expect(saveBtn.disabled).toBe(true);
    });

    it('should enable saveBtn when entering a valid name (1-20 characters)', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');

      nameInput.value = 'Test'; // 4 characters
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

      expect(saveBtn.disabled).toBe(false);
    });

    it('should disable saveBtn when entering 21+ characters and clicking should not change greeting or call localStorage.setItem', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');
      const greeting = document.getElementById('greeting');

      // Enter valid name first, then invalid
      nameInput.value = 'a'.repeat(5);
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      expect(saveBtn.disabled).toBe(false);

      // Save to set initial greeting
      saveBtn.click();
      const initialGreeting = greeting.textContent;
      const setItemCallsBefore = window.localStorage.setItem.mock.calls.length;

      // Now enter 21+ characters - button should disable
      nameInput.value = 'a'.repeat(21);
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      expect(saveBtn.disabled).toBe(true);

      // Click when disabled - should not change greeting or call setItem for userName
      saveBtn.click();

      expect(greeting.textContent).toBe(initialGreeting);
      const userNameCalls = window.localStorage.setItem.mock.calls.filter(
        (call) => call[0] === 'userName'
      );
      // Number of userName setItem calls should be same as before (we had 1 from the initial save)
      expect(userNameCalls.length).toBe(1);
    });
  });

  describe('SCRUM-15: Keyboard UX for name input and banner', () => {
    it('should update greeting and localStorage when pressing Enter in input with valid name', () => {
      const nameInput = document.getElementById('nameInput');
      const greeting = document.getElementById('greeting');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(greeting.textContent).toBe('Dobrodošli, Ana!');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('userName', 'Ana');
    });

    it('should clear input and error message when pressing Escape in nameInput', () => {
      setupDOM({ userName: 'Marko' });
      const nameInput = document.getElementById('nameInput');
      const nameError = document.getElementById('nameError');
      const greeting = document.getElementById('greeting');

      nameInput.value = 'invalid typo';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(nameInput.value).toBe('');
      expect(nameError.textContent).toBe('');
      expect(greeting.textContent).toBe('Dobrodošli, Marko!');
    });

    it('should hide banner and set bannerDismissed when pressing Enter on bannerCloseBtn', () => {
      const banner = document.getElementById('banner');
      const bannerCloseBtn = document.getElementById('bannerCloseBtn');

      expect(banner.classList.contains('hidden')).toBe(false);

      bannerCloseBtn.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(banner.classList.contains('hidden')).toBe(true);
      expect(window.localStorage.setItem).toHaveBeenCalledWith('bannerDismissed', 'true');
    });

    it('should hide banner and set bannerDismissed when pressing Space on bannerCloseBtn', () => {
      setupDOM();
      const banner = document.getElementById('banner');
      const bannerCloseBtn = document.getElementById('bannerCloseBtn');

      expect(banner.classList.contains('hidden')).toBe(false);

      bannerCloseBtn.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(banner.classList.contains('hidden')).toBe(true);
      expect(window.localStorage.setItem).toHaveBeenCalledWith('bannerDismissed', 'true');
    });

    it('should show error when pressing Enter with empty input', () => {
      const nameInput = document.getElementById('nameInput');
      const nameError = document.getElementById('nameError');

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(nameError.textContent).toContain('Ime je obavezno');
      expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('should hide banner on page load when bannerDismissed is in localStorage', () => {
      setupDOM({ bannerDismissed: 'true' });
      const banner = document.getElementById('banner');

      expect(banner.classList.contains('hidden')).toBe(true);
    });
  });
});
