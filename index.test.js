import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('Code Merlin SCRUM-9: User Profile Greeting', () => {
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
    
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
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

  it('should show error message when trying to save an empty name', () => {
    const nameInput = document.getElementById('nameInput');
    const saveBtn = document.getElementById('saveBtn');
    const errorMsg = document.getElementById('errorMsg');

    nameInput.value = '   ';
    saveBtn.click();

    expect(errorMsg.textContent).toBe('Ime ne može biti prazno.');
    expect(window.localStorage.setItem).not.toHaveBeenCalledWith('username', expect.any(String));
  });

  it('should show error message when name is too long', () => {
    const nameInput = document.getElementById('nameInput');
    const saveBtn = document.getElementById('saveBtn');
    const errorMsg = document.getElementById('errorMsg');

    nameInput.value = 'OvoJeImeKojeImaViseOdDvadesetKaraktera';
    saveBtn.click();

    expect(errorMsg.textContent).toBe('Ime ne može biti duže od 20 karaktera.');
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
});
