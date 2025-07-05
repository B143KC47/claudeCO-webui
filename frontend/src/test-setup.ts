import "@testing-library/jest-dom";

// Mock window.matchMedia for tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false, // Default to light mode for tests
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage for tests
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock indexedDB for tests
const indexedDBMock = {
  open: () => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      transaction: () => ({
        objectStore: () => ({
          get: () => ({ onsuccess: null, onerror: null }),
          put: () => ({ onsuccess: null, onerror: null }),
          delete: () => ({ onsuccess: null, onerror: null }),
          getAll: () => ({ onsuccess: null, onerror: null }),
          clear: () => ({ onsuccess: null, onerror: null }),
        }),
      }),
      close: () => {},
    },
  }),
  deleteDatabase: () => ({ onsuccess: null, onerror: null }),
};

Object.defineProperty(window, "indexedDB", {
  value: indexedDBMock,
});
