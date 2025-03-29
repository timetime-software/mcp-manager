import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Add testing-library matchers to vitest's expect
expect.extend(matchers);

// Mock de window.electron para los tests
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: vi.fn()
    }
  },
  writable: true
}); 