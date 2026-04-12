import { describe, it, expect } from 'vitest';
import { formatText, previewFormatting, DEFAULT_FORMATTING, FormattingOptions } from '../../lib/text-formatter';

describe('text-formatter', () => {
  describe('formatText', () => {
    describe('autoCapitalize', () => {
      it('capitalizes first letter of text', () => {
        const result = formatText('hello world', { autoCapitalize: true });
        expect(result).toBe('Hello world');
      });

      it('capitalizes after period', () => {
        const result = formatText('hello. world', { autoCapitalize: true });
        expect(result).toBe('Hello. World');
      });

      it('capitalizes after exclamation', () => {
        const result = formatText('wow! that is great', { autoCapitalize: true });
        expect(result).toBe('Wow! That is great');
      });

      it('capitalizes after question mark', () => {
        const result = formatText('how are you? i am fine', { autoCapitalize: true });
        expect(result).toBe('How are you? I am fine');
      });

      it('preserves already capitalized text', () => {
        const result = formatText('Hello World', { autoCapitalize: true });
        expect(result).toBe('Hello World');
      });
    });

    describe('smartPunctuation', () => {
      it('removes double spaces', () => {
        const result = formatText('hello  world', { smartPunctuation: true, autoCapitalize: false });
        expect(result).toBe('hello world');
      });

      it('adds space after punctuation', () => {
        const result = formatText('hello,world', { smartPunctuation: true, autoCapitalize: false });
        expect(result).toBe('hello, world');
      });

      it('removes space before punctuation', () => {
        const result = formatText('hello ,world', { smartPunctuation: true, autoCapitalize: false });
        expect(result).toBe('hello, world');
      });

      it('converts double hyphen to em-dash', () => {
        const result = formatText('hello -- world', { smartPunctuation: true, autoCapitalize: false });
        expect(result).toBe('hello — world');
      });

      it('fixes ellipsis', () => {
        const result = formatText('wait....', { smartPunctuation: true, autoCapitalize: false });
        expect(result).toBe('wait...');
      });
    });

    describe('smartQuotes', () => {
      it('converts double quotes to curly quotes', () => {
        const result = formatText('He said "hello"', { smartQuotes: true, autoCapitalize: false, smartPunctuation: false });
        expect(result).toBe('He said \u201Chello\u201D');
      });

      it('converts single quotes to curly quotes', () => {
        const result = formatText("It's a 'test'", { smartQuotes: true, autoCapitalize: false, smartPunctuation: false });
        expect(result).toBe("It\u2019s a \u2018test\u2019");
      });
    });

    describe('numberFormatting', () => {
      it('converts words to digits when set to digits', () => {
        const result = formatText('I have five apples', { numberFormatting: 'digits', autoCapitalize: false, smartPunctuation: false });
        expect(result).toBe('I have 5 apples');
      });

      it('converts digits to words when set to words', () => {
        const result = formatText('I have 5 apples', { numberFormatting: 'words', autoCapitalize: false, smartPunctuation: false });
        expect(result).toBe('I have five apples');
      });

      it('keeps technical numbers as digits in auto mode', () => {
        const result = formatText('version 2.0 has five features', { numberFormatting: 'auto', autoCapitalize: false, smartPunctuation: false });
        expect(result).toContain('2.0');
        expect(result).toContain('5');
      });
    });

    describe('listDetection', () => {
      it('normalizes bullet points', () => {
        const result = formatText('- item one\n- item two', { listDetection: true, autoCapitalize: false, smartPunctuation: false });
        expect(result).toBe('• item one\n• item two');
      });

      it('normalizes numbered lists', () => {
        const result = formatText('1. first\n2. second', { listDetection: true, autoCapitalize: false, smartPunctuation: false });
        expect(result).toContain('1. first');
        expect(result).toContain('2. second');
      });
    });

    describe('trimWhitespace', () => {
      it('trims leading and trailing whitespace', () => {
        const result = formatText('  hello world  ', { trimWhitespace: true, autoCapitalize: false, smartPunctuation: false });
        expect(result).toBe('hello world');
      });
    });

    describe('combined options', () => {
      it('applies multiple formatting rules', () => {
        const result = formatText('  hello  world.this is a test  ', {
          trimWhitespace: true,
          autoCapitalize: true,
          smartPunctuation: true,
        });
        expect(result).toBe('Hello world. This is a test');
      });
    });
  });

  describe('previewFormatting', () => {
    it('returns before and after text', () => {
      const result = previewFormatting('hello world', { autoCapitalize: true });
      expect(result.before).toBe('hello world');
      expect(result.after).toBe('Hello world');
    });

    it('lists changes made', () => {
      const result = previewFormatting('hello world', { autoCapitalize: true });
      expect(result.changes).toContain('Capitalization');
    });

    it('returns empty changes when no formatting needed', () => {
      const result = previewFormatting('Hello world', { autoCapitalize: true, smartPunctuation: false });
      expect(result.before).toBe(result.after);
    });
  });

  describe('DEFAULT_FORMATTING', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_FORMATTING.autoCapitalize).toBe(true);
      expect(DEFAULT_FORMATTING.smartPunctuation).toBe(true);
      expect(DEFAULT_FORMATTING.trimWhitespace).toBe(true);
      expect(DEFAULT_FORMATTING.smartQuotes).toBe(false);
      expect(DEFAULT_FORMATTING.numberFormatting).toBe('auto');
    });
  });
});
