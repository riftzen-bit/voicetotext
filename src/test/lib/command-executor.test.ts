import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeCommand,
  registerNavigationCallback,
  registerSettingsCallback,
  CommandResult,
  NavigationTarget,
} from '../../lib/command-executor';
import { ParsedCommand } from '../../lib/command-parser';

// Mock the IPC module
vi.mock('../../lib/ipc', () => ({
  getApi: () => ({
    loadModel: vi.fn(),
    startModelDownload: vi.fn(),
    clearHistory: vi.fn(),
    getHistory: vi.fn().mockResolvedValue([{ text: 'test transcript' }]),
    getSettings: vi.fn().mockResolvedValue({ codeMode: false }),
  }),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('command-executor', () => {
  let navigationCallback: (target: NavigationTarget) => void;
  let settingsCallback: (key: string, value: unknown) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    navigationCallback = vi.fn();
    settingsCallback = vi.fn().mockResolvedValue(undefined);
    registerNavigationCallback(navigationCallback);
    registerSettingsCallback(settingsCallback);
  });

  describe('executeCommand', () => {
    describe('navigation commands', () => {
      it('navigates to settings', async () => {
        const command: ParsedCommand = {
          type: 'navigation',
          action: 'open_settings',
          args: [],
          confidence: 0.9,
          originalText: 'open settings',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(navigationCallback).toHaveBeenCalledWith('general');
      });

      it('navigates to history', async () => {
        const command: ParsedCommand = {
          type: 'navigation',
          action: 'open_history',
          args: [],
          confidence: 0.9,
          originalText: 'show history',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(navigationCallback).toHaveBeenCalledWith('history');
      });

      it('navigates to templates', async () => {
        const command: ParsedCommand = {
          type: 'navigation',
          action: 'open_templates',
          args: [],
          confidence: 0.9,
          originalText: 'open templates',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(navigationCallback).toHaveBeenCalledWith('templates');
      });

      it('fails for unknown navigation target', async () => {
        const command: ParsedCommand = {
          type: 'navigation',
          action: 'unknown_action',
          args: [],
          confidence: 0.9,
          originalText: 'go somewhere',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown navigation target');
      });
    });

    describe('settings commands', () => {
      it('toggles dark mode', async () => {
        const command: ParsedCommand = {
          type: 'settings',
          action: 'toggle_dark_mode',
          args: [],
          confidence: 0.9,
          originalText: 'dark mode',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(settingsCallback).toHaveBeenCalledWith('appearance', { theme: 'dark' });
      });

      it('toggles light mode', async () => {
        const command: ParsedCommand = {
          type: 'settings',
          action: 'toggle_light_mode',
          args: [],
          confidence: 0.9,
          originalText: 'light mode',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(settingsCallback).toHaveBeenCalledWith('appearance', { theme: 'light' });
      });

      it('toggles system theme', async () => {
        const command: ParsedCommand = {
          type: 'settings',
          action: 'toggle_system_theme',
          args: [],
          confidence: 0.9,
          originalText: 'system theme',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(settingsCallback).toHaveBeenCalledWith('appearance', { theme: 'system' });
      });
    });

    describe('mode commands', () => {
      it('enables code mode', async () => {
        const command: ParsedCommand = {
          type: 'mode',
          action: 'enable_code_mode',
          args: [],
          confidence: 0.9,
          originalText: 'enable code mode',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(settingsCallback).toHaveBeenCalledWith('codeMode', true);
      });

      it('disables code mode', async () => {
        const command: ParsedCommand = {
          type: 'mode',
          action: 'disable_code_mode',
          args: [],
          confidence: 0.9,
          originalText: 'disable code mode',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(settingsCallback).toHaveBeenCalledWith('codeMode', false);
      });

      it('switches to push-to-talk', async () => {
        const command: ParsedCommand = {
          type: 'mode',
          action: 'toggle_ptt',
          args: [],
          confidence: 0.9,
          originalText: 'push to talk',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(settingsCallback).toHaveBeenCalledWith('hotkeyMode', 'ptt');
      });

      it('switches to toggle-to-talk', async () => {
        const command: ParsedCommand = {
          type: 'mode',
          action: 'toggle_ttt',
          args: [],
          confidence: 0.9,
          originalText: 'toggle to talk',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(settingsCallback).toHaveBeenCalledWith('hotkeyMode', 'ttt');
      });
    });

    describe('history commands', () => {
      it('clears history', async () => {
        const command: ParsedCommand = {
          type: 'history',
          action: 'clear_history',
          args: [],
          confidence: 0.9,
          originalText: 'clear history',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(result.message).toBe('History cleared');
      });

      it('copies last transcript', async () => {
        const command: ParsedCommand = {
          type: 'history',
          action: 'copy_last',
          args: [],
          confidence: 0.9,
          originalText: 'copy last',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test transcript');
      });
    });

    describe('model commands', () => {
      it('loads a model', async () => {
        const command: ParsedCommand = {
          type: 'model',
          action: 'load_model',
          args: ['large'],
          confidence: 0.9,
          originalText: 'load model large',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(result.message).toContain('large-v3');
      });

      it('downloads a model', async () => {
        const command: ParsedCommand = {
          type: 'model',
          action: 'download_model',
          args: ['small'],
          confidence: 0.9,
          originalText: 'download model small',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(true);
        expect(result.message).toContain('small');
      });

      it('fails without model specified', async () => {
        const command: ParsedCommand = {
          type: 'model',
          action: 'load_model',
          args: [],
          confidence: 0.9,
          originalText: 'load model',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No model specified');
      });
    });

    describe('unknown commands', () => {
      it('returns error for unknown type', async () => {
        const command: ParsedCommand = {
          type: 'unknown' as any,
          action: 'something',
          args: [],
          confidence: 0.5,
          originalText: 'do something',
        };

        const result = await executeCommand(command);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown command type');
      });
    });
  });

  describe('callback registration', () => {
    it('fails navigation when callback not registered', async () => {
      // Reset callbacks
      registerNavigationCallback(null as any);

      const command: ParsedCommand = {
        type: 'navigation',
        action: 'open_settings',
        args: [],
        confidence: 0.9,
        originalText: 'open settings',
      };

      const result = await executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Navigation not available');
    });

    it('fails settings when callback not registered', async () => {
      // Reset callbacks
      registerSettingsCallback(null as any);

      const command: ParsedCommand = {
        type: 'settings',
        action: 'toggle_dark_mode',
        args: [],
        confidence: 0.9,
        originalText: 'dark mode',
      };

      const result = await executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Settings not available');
    });
  });
});
