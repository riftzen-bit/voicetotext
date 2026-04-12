import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  hasCommandTrigger,
  removeCommandTrigger,
  looksLikeCommand,
  getAvailableCommands,
} from '../../lib/command-parser';

describe('command-parser', () => {
  describe('parseCommand', () => {
    describe('navigation commands', () => {
      it('parses "open settings"', () => {
        const result = parseCommand('open settings');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('navigation');
        expect(result?.action).toBe('open_settings');
      });

      it('parses "show history"', () => {
        const result = parseCommand('show history');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('navigation');
        expect(result?.action).toBe('open_history');
      });

      it('parses "go to templates"', () => {
        const result = parseCommand('go to templates');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('open_templates');
      });

      it('parses "shortcuts" alone', () => {
        const result = parseCommand('shortcuts');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('open_shortcuts');
      });
    });

    describe('settings commands', () => {
      it('parses "switch to dark mode"', () => {
        const result = parseCommand('switch to dark mode');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('settings');
        expect(result?.action).toBe('toggle_dark_mode');
      });

      it('parses "light theme"', () => {
        const result = parseCommand('light theme');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('toggle_light_mode');
      });

      it('parses "use system theme"', () => {
        const result = parseCommand('use system theme');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('toggle_system_theme');
      });
    });

    describe('model commands', () => {
      it('parses "load model large"', () => {
        const result = parseCommand('load model large');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('model');
        expect(result?.action).toBe('load_model');
        expect(result?.args).toContain('large');
      });

      it('parses "switch to turbo"', () => {
        const result = parseCommand('switch to turbo');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('load_model');
      });

      it('parses "download model small"', () => {
        const result = parseCommand('download model small');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('download_model');
        expect(result?.args).toContain('small');
      });
    });

    describe('history commands', () => {
      it('parses "clear history"', () => {
        const result = parseCommand('clear history');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('history');
        expect(result?.action).toBe('clear_history');
      });

      it('parses "copy last"', () => {
        const result = parseCommand('copy last');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('copy_last');
      });

      it('parses "delete all transcripts"', () => {
        const result = parseCommand('delete all transcripts');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('clear_history');
      });
    });

    describe('mode commands', () => {
      it('parses "toggle code mode"', () => {
        const result = parseCommand('toggle code mode');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('mode');
        expect(result?.action).toBe('toggle_code_mode');
      });

      it('parses "enable code mode"', () => {
        const result = parseCommand('enable code mode');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('enable_code_mode');
      });

      it('parses "code mode off"', () => {
        const result = parseCommand('code mode off');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('disable_code_mode');
      });

      it('parses "switch to push to talk"', () => {
        const result = parseCommand('switch to push to talk');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('toggle_ptt');
      });

      it('parses "ttt"', () => {
        const result = parseCommand('ttt');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('toggle_ttt');
      });
    });

    describe('non-commands', () => {
      it('returns null for regular text', () => {
        const result = parseCommand('The quick brown fox jumps over the lazy dog');
        expect(result).toBeNull();
      });

      it('returns null for very long text', () => {
        const result = parseCommand('open settings and then go to the history tab and clear all the old transcripts from last week');
        expect(result).toBeNull();
      });
    });
  });

  describe('hasCommandTrigger', () => {
    it('detects "hey voice to text" trigger', () => {
      expect(hasCommandTrigger('hey voice to text open settings')).toBe(true);
    });

    it('detects "vtt" trigger', () => {
      expect(hasCommandTrigger('vtt dark mode')).toBe(true);
    });

    it('detects "computer" trigger', () => {
      expect(hasCommandTrigger('computer clear history')).toBe(true);
    });

    it('detects "command" trigger', () => {
      expect(hasCommandTrigger('command open settings')).toBe(true);
    });

    it('returns false for no trigger', () => {
      expect(hasCommandTrigger('open settings')).toBe(false);
    });
  });

  describe('removeCommandTrigger', () => {
    it('removes "hey vtt" trigger', () => {
      expect(removeCommandTrigger('hey vtt open settings')).toBe('open settings');
    });

    it('removes "computer" trigger', () => {
      expect(removeCommandTrigger('computer dark mode')).toBe('dark mode');
    });

    it('leaves text without trigger unchanged', () => {
      expect(removeCommandTrigger('open settings')).toBe('open settings');
    });
  });

  describe('looksLikeCommand', () => {
    it('returns true for imperative verbs', () => {
      expect(looksLikeCommand('open settings')).toBe(true);
      expect(looksLikeCommand('switch to dark mode')).toBe(true);
      expect(looksLikeCommand('clear history')).toBe(true);
    });

    it('returns true for command triggers', () => {
      expect(looksLikeCommand('hey vtt do something')).toBe(true);
    });

    it('returns false for regular sentences', () => {
      expect(looksLikeCommand('The weather is nice today')).toBe(false);
      expect(looksLikeCommand('I am going to the store')).toBe(false);
    });
  });

  describe('getAvailableCommands', () => {
    it('returns commands grouped by type', () => {
      const commands = getAvailableCommands();

      expect(commands.navigation).toContain('open_settings');
      expect(commands.navigation).toContain('open_history');
      expect(commands.settings).toContain('toggle_dark_mode');
      expect(commands.model).toContain('load_model');
      expect(commands.history).toContain('clear_history');
      expect(commands.mode).toContain('toggle_code_mode');
    });

    it('has empty unknown array', () => {
      const commands = getAvailableCommands();
      expect(commands.unknown).toHaveLength(0);
    });
  });
});
