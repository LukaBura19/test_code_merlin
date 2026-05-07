import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('SCRUM-28: :focus-visible styles', () => {
  it('should define focus ring variables and :focus-visible rules in index.html', () => {
    expect(html).toContain(':focus-visible');
    expect(html).toContain('--focus-ring-color');
    expect(html).toContain('button:focus-visible');
    expect(html).toContain('#nameInput:focus-visible');
    expect(html).toContain('button:focus:not(:focus-visible)');
    expect(html).toContain('COD-1');
    expect(html).toContain('#bannerCloseBtn:focus-visible');
  });
});

describe('SCRUM-34: theme toggle keyboard focus', () => {
  it('should include #themeToggle:focus-visible styles in index.html', () => {
    expect(html).toContain('#themeToggle:focus-visible');
    expect(html).toContain('#themeToggle:focus:not(:focus-visible)');
  });
});

describe('Code Merlin Landing Page', () => {
  let dom;
  let document;
  let window;
  let localStorageStore = {};

  const setupDOM = (mockLocalStorage = {}, mockSystemDark = false, setItemThrows = false, removeItemThrows = false) => {
    localStorageStore = { ...mockLocalStorage };

    const setItemImpl = setItemThrows
      ? vi.fn(() => { throw new Error('QuotaExceededError'); })
      : vi.fn((key, value) => { localStorageStore[key] = value.toString(); });

    const removeItemImpl = removeItemThrows
      ? vi.fn(() => { throw new Error('SecurityError'); })
      : vi.fn((key) => { delete localStorageStore[key]; });

    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
      beforeParse: (win) => {
        Object.defineProperty(win, 'localStorage', {
          value: {
            getItem: vi.fn((key) => (key in localStorageStore ? localStorageStore[key] : null)),
            setItem: setItemImpl,
            removeItem: removeItemImpl,
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

  it('should toggle theme on button click and update aria-label, title, and visible text', () => {
    const button = document.getElementById('themeToggle');
    const docEl = document.documentElement;

    // Initial state (light)
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');
    expect(button.getAttribute('title')).toBe('Prebaci na tamnu temu');
    expect(button.textContent).toBe('Prebaci na tamnu temu');

    // Click to dark
    button.click();
    expect(docEl.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na svetlu temu');
    expect(button.getAttribute('title')).toBe('Prebaci na svetlu temu');
    expect(button.textContent).toBe('Prebaci na svetlu temu');

    // Click back to light
    button.click();
    expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');
    expect(button.getAttribute('title')).toBe('Prebaci na tamnu temu');
    expect(button.textContent).toBe('Prebaci na tamnu temu');
  });

  it('should initialize with dark theme if saved in localStorage', () => {
    // We need to simulate the state BEFORE the script runs in JSDOM
    // Since JSDOM runs scripts on creation, we use a fresh instance
    const localStore = { theme: 'dark' };
    setupDOM(localStore);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const button = document.getElementById('themeToggle');
    expect(button.getAttribute('title')).toBe('Prebaci na svetlu temu');
    expect(button.getAttribute('aria-label')).toBe('Prebaci na svetlu temu');
  });

  describe('SCRUM-30: theme persistence read/write flow', () => {
    it('should apply persisted dark theme on init and write light on toggle', () => {
      setupDOM({ theme: 'dark' });
      const button = document.getElementById('themeToggle');
      const docEl = document.documentElement;

      expect(docEl.getAttribute('data-theme')).toBe('dark');
      expect(button.getAttribute('aria-pressed')).toBe('true');

      button.click();

      expect(docEl.getAttribute('data-theme')).not.toBe('dark');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    });

    it('should prefer persisted light over system dark and write dark on toggle', () => {
      setupDOM({ theme: 'light' }, true);
      const button = document.getElementById('themeToggle');
      const docEl = document.documentElement;

      expect(docEl.getAttribute('data-theme')).not.toBe('dark');
      expect(button.getAttribute('aria-pressed')).toBe('false');

      button.click();

      expect(docEl.getAttribute('data-theme')).toBe('dark');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
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

  describe('Reset theme button', () => {
    it('exposes a visible, clickable reset control next to theme toggle', () => {
      const resetBtn = document.getElementById('themeResetBtn');
      const themeToggle = document.getElementById('themeToggle');

      expect(resetBtn).not.toBeNull();
      expect(resetBtn.textContent.trim().length).toBeGreaterThan(0);
      expect(resetBtn.getAttribute('type')).toBe('button');
      expect(resetBtn.getAttribute('aria-label')).toBeTruthy();
      expect(resetBtn.getAttribute('title')).toBeTruthy();
      expect(themeToggle.nextElementSibling).toBe(resetBtn);
    });

    it('removes persisted theme, applies system default immediately, and stays default after reload', () => {
      setupDOM({ theme: 'dark' }, false);
      const docEl = document.documentElement;
      const themeToggle = document.getElementById('themeToggle');
      const resetBtn = document.getElementById('themeResetBtn');

      expect(docEl.getAttribute('data-theme')).toBe('dark');

      resetBtn.click();

      expect(localStorageStore.theme).toBeUndefined();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('theme');
      expect(docEl.getAttribute('data-theme')).not.toBe('dark');
      expect(themeToggle.getAttribute('aria-pressed')).toBe('false');

      setupDOM(localStorageStore, false);
      expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');
    });

    it('after reset follows system dark preference when no theme is stored', () => {
      setupDOM({ theme: 'light' }, true);
      expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');

      document.getElementById('themeResetBtn').click();

      expect(localStorageStore.theme).toBeUndefined();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.getElementById('themeToggle').getAttribute('aria-pressed')).toBe('true');
    });

    it('keeps theme toggle labels in sync after reset', () => {
      setupDOM({ theme: 'dark' }, false);
      const themeToggle = document.getElementById('themeToggle');

      document.getElementById('themeResetBtn').click();

      expect(themeToggle.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');
      expect(themeToggle.textContent).toBe('Prebaci na tamnu temu');
    });

    it('resets theme when pressing Enter on focused reset button', () => {
      setupDOM({ theme: 'dark' }, false);
      const resetBtn = document.getElementById('themeResetBtn');
      resetBtn.focus();
      resetBtn.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(localStorageStore.theme).toBeUndefined();
      expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');
    });

    it('resets theme when pressing Space on focused reset button', () => {
      setupDOM({ theme: 'dark' }, false);
      const resetBtn = document.getElementById('themeResetBtn');
      resetBtn.focus();
      resetBtn.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(localStorageStore.theme).toBeUndefined();
      expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');
    });

    it('reset theme button is visible (not hidden via layout)', () => {
      const resetBtn = document.getElementById('themeResetBtn');
      const style = window.getComputedStyle(resetBtn);
      expect(style.display).not.toBe('none');
      expect(style.visibility).not.toBe('hidden');
    });

    it('still applies system default theme when removeItem throws', () => {
      setupDOM({ theme: 'dark' }, false, false, true);
      document.getElementById('themeResetBtn').click();
      expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('theme');
    });
  });

  describe('SCRUM-19: Global keyboard shortcut for theme switching', () => {
    it('should toggle theme when pressing Ctrl+Shift+T (same as clicking themeToggle)', () => {
      const docEl = document.documentElement;
      const themeToggle = document.getElementById('themeToggle');

      expect(docEl.getAttribute('data-theme')).not.toBe('dark');

      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'T',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      }));

      expect(docEl.getAttribute('data-theme')).toBe('dark');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
      expect(themeToggle.getAttribute('aria-label')).toBe('Prebaci na svetlu temu');
    });

    it('should restore original theme when pressing Ctrl+Shift+T again', () => {
      const docEl = document.documentElement;
      const themeToggle = document.getElementById('themeToggle');

      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'T',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      }));
      expect(docEl.getAttribute('data-theme')).toBe('dark');

      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'T',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      }));
      expect(docEl.getAttribute('data-theme')).not.toBe('dark');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
      expect(themeToggle.getAttribute('aria-label')).toBe('Prebaci na tamnu temu');
    });

    it('should not toggle theme when typing T in nameInput without modifiers', () => {
      const nameInput = document.getElementById('nameInput');
      expect(document.activeElement).toBe(nameInput);
    });

    it('should toggle theme when pressing T with focus outside text-entry elements', () => {
      const docEl = document.documentElement;
      const themeToggle = document.getElementById('themeToggle');
      const nameInput = document.getElementById('nameInput');

      nameInput.blur();

      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'T',
        bubbles: true
      }));

      expect(docEl.getAttribute('data-theme')).toBe('dark');
      expect(themeToggle.getAttribute('aria-label')).toBe('Prebaci na svetlu temu');
    });

    it('should not toggle theme when pressing T while Alt is held', () => {
      const docEl = document.documentElement;
      const nameInput = document.getElementById('nameInput');

      nameInput.blur();

      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'T',
        altKey: true,
        bubbles: true
      }));

      expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    });

    it('should not toggle theme when pressing t inside a textarea', () => {
      const docEl = document.documentElement;
      const textarea = document.createElement('textarea');
      textarea.id = 'testNotes';
      document.body.appendChild(textarea);
      textarea.focus();

      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 't',
        bubbles: true
      }));

      expect(docEl.getAttribute('data-theme')).not.toBe('dark');
    });

    it('should toggle theme when pressing t while focus is on a checkbox', () => {
      const docEl = document.documentElement;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      document.body.appendChild(checkbox);
      checkbox.focus();

      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 't',
        bubbles: true
      }));

      expect(docEl.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('SCRUM-25: Storage message dismiss persistence', () => {
    it('hides storage message on dismiss and sets storageMessageDismissed in localStorage', () => {
      setupDOM();
      const storageMessage = document.getElementById('storageMessage');
      const dismissBtn = storageMessage.querySelector('.dismiss-btn');

      storageMessage.classList.remove('hidden');
      dismissBtn.click();

      expect(storageMessage.classList.contains('hidden')).toBe(true);
      expect(localStorageStore.storageMessageDismissed).toBe('true');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('storageMessageDismissed', 'true');
    });

    it('keeps storage message hidden on load when storageMessageDismissed is already set', () => {
      setupDOM({ storageMessageDismissed: 'true' });
      const storageMessage = document.getElementById('storageMessage');
      expect(storageMessage.classList.contains('hidden')).toBe(true);
    });

    it('stays hidden after reload when user dismissed and theme save still fails', () => {
      setupDOM();
      const storageMessage = document.getElementById('storageMessage');
      const dismissBtn = storageMessage.querySelector('.dismiss-btn');
      storageMessage.classList.remove('hidden');
      dismissBtn.click();
      expect(localStorageStore.storageMessageDismissed).toBe('true');

      setupDOM(localStorageStore, false, true);
      const reloaded = document.getElementById('storageMessage');
      document.getElementById('themeToggle').click();
      expect(reloaded.classList.contains('hidden')).toBe(true);
    });

    it('shows storage message again after dismiss flag is cleared when theme cannot be saved', () => {
      const store = { storageMessageDismissed: 'true' };
      setupDOM(store, false, true);
      delete store.storageMessageDismissed;
      setupDOM(store, false, true);

      document.getElementById('themeToggle').click();
      const storageMessage = document.getElementById('storageMessage');
      expect(storageMessage.classList.contains('hidden')).toBe(false);
    });
  });

  describe('SCRUM-35: Theme shortcut discoverability', () => {
    it('should show Ctrl+Shift+T hint and expose aria-keyshortcuts on theme toggle', () => {
      const hint = document.getElementById('themeShortcutHint');
      const themeToggle = document.getElementById('themeToggle');

      expect(hint).toBeTruthy();
      expect(hint.textContent).toMatch(/Ctrl/);
      expect(hint.textContent).toMatch(/Shift/);
      expect(themeToggle.getAttribute('aria-keyshortcuts')).toBe('Control+Shift+T');
    });
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

  describe('SCRUM-21: Greeting fade-in animation', () => {
    it('should apply greeting-fade-in class after saving a name', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');
      const greeting = document.getElementById('greeting');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(greeting.textContent).toBe('Dobrodošli, Ana!');
      expect(greeting.classList.contains('greeting-fade-in')).toBe(true);
    });

    it('should not affect greeting functionality - greeting still updates correctly', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');
      const greeting = document.getElementById('greeting');

      nameInput.value = 'Petar';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(greeting.textContent).toBe('Dobrodošli, Petar!');

      nameInput.value = 'Jelena';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(greeting.textContent).toBe('Dobrodošli, Jelena!');
    });

    it('should not apply animation on initial page load with saved name', () => {
      setupDOM({ userName: 'Marko' });
      const greeting = document.getElementById('greeting');
      expect(greeting.textContent).toBe('Dobrodošli, Marko!');
      expect(greeting.classList.contains('greeting-fade-in')).toBe(false);
    });
  });

  describe('SCRUM-29: basic empty-state message', () => {
    it('should show empty state and hide greeting when there is no saved name', () => {
      const emptyState = document.getElementById('contentEmptyState');
      const greeting = document.getElementById('greeting');

      expect(emptyState.classList.contains('hidden')).toBe(false);
      expect(emptyState.textContent).toContain('No data yet');
      expect(emptyState.textContent).toContain('Save your name');
      expect(greeting.classList.contains('hidden')).toBe(true);
      expect(greeting.textContent).toBe('');
    });

    it('should hide empty state and show greeting when a name is saved', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');
      const emptyState = document.getElementById('contentEmptyState');
      const greeting = document.getElementById('greeting');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(emptyState.classList.contains('hidden')).toBe(true);
      expect(greeting.classList.contains('hidden')).toBe(false);
      expect(greeting.textContent).toBe('Dobrodošli, Ana!');
    });

    it('should hide empty state on load when userName exists in localStorage', () => {
      setupDOM({ userName: 'Luka' });
      const emptyState = document.getElementById('contentEmptyState');
      const greeting = document.getElementById('greeting');

      expect(emptyState.classList.contains('hidden')).toBe(true);
      expect(greeting.classList.contains('hidden')).toBe(false);
      expect(greeting.textContent).toBe('Dobrodošli, Luka!');
    });
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

    it('should show success message after saving valid name (SCRUM-17)', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt (SCRUM-17)', () => {
      const saveBtn = document.getElementById('saveBtn');
      const nameInput = document.getElementById('nameInput');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
    });

    it('should hide success message when pressing Escape (SCRUM-17)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
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

  describe('SCRUM-20: Auto-trim and format name on save', () => {
    it('should save "Marko" when entering " marko " (trim + format)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');

      nameInput.value = ' marko ';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(window.localStorage.setItem).toHaveBeenCalledWith('userName', 'Marko');
      expect(document.getElementById('greeting').textContent).toBe('Dobrodošli, Marko!');
      expect(nameInput.value).toBe('Marko');
    });

    it('should show error and save nothing when entering only spaces', () => {
      const nameInput = document.getElementById('nameInput');
      const nameError = document.getElementById('nameError');
      const saveBtn = document.getElementById('saveBtn');

      nameInput.value = '   ';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(nameError.textContent).toContain('Ime ne može biti prazno');
      const userNameCalls = window.localStorage.setItem.mock.calls.filter((c) => c[0] === 'userName');
      expect(userNameCalls.length).toBe(0);
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
    });

    it('should hide success message when pressing Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });

    it('should auto-hide success message after 4 seconds', () => {
      vi.useFakeTimers();
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(4000);

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });

    it('should auto-hide success message after 4 seconds', () => {
      vi.useFakeTimers();
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(4000);

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });

    it('should auto-hide success message after 4 seconds', () => {
      vi.useFakeTimers();
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(4000);

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });

    it('should auto-hide success message after 4 seconds', () => {
      vi.useFakeTimers();
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(4000);

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });

    it('should auto-hide success message after 4 seconds', () => {
      vi.useFakeTimers();
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(4000);
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });

    it('should auto-hide success message after 4 seconds', () => {
      vi.useFakeTimers();
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(4000);

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when pressing Escape', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
    });

    it('should show success message again on next save (previous message replaced)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
    });

    it('should hide success message when pressing Escape', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after save', () => {
    it('should show success message after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      document.getElementById('saveBtn').click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after save', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      document.getElementById('saveBtn').click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after save', () => {
    it('should show success message after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      document.getElementById('saveBtn').click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after save', () => {
    it('should show success message after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on Escape (reset)', () => {
      const nameInput = document.getElementById('nameInput');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      document.getElementById('saveBtn').click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
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

      expect(nameError.textContent).toContain('Ime ne može biti prazno');
      expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('should hide banner on page load when bannerDismissed is in localStorage', () => {
      setupDOM({ bannerDismissed: 'true' });
      const banner = document.getElementById('banner');

      expect(banner.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SCRUM-17: Confirmation message after successfully saving the name', () => {
    it('should show "Ime je uspešno sačuvano." after valid save', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message on next save attempt', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.value = 'Marko';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);
      expect(saveSuccessMessage.textContent).toBe('Ime je uspešno sačuvano.');
    });

    it('should hide success message when Escape clears input', () => {
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('saveBtn');
      const saveSuccessMessage = document.getElementById('saveSuccessMessage');

      nameInput.value = 'Ana';
      nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      saveBtn.click();
      expect(saveSuccessMessage.classList.contains('hidden')).toBe(false);

      nameInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(saveSuccessMessage.classList.contains('hidden')).toBe(true);
    });
  });
});
