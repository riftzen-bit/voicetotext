import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refineTextWithGemini } from '../../lib/gemini';

// Helper to extract the system instruction from fetch calls
function getSystemInstruction(fetchMock: ReturnType<typeof vi.fn>): string {
  const call = fetchMock.mock.calls[0];
  const body = JSON.parse(call[1].body);
  return body.systemInstruction?.parts?.[0]?.text || '';
}

describe('refineTextWithGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns original text when API key is empty', async () => {
    const text = 'hello world';
    const result = await refineTextWithGemini(text, '');
    expect(result).toBe(text);
  });

  it('returns original text when text is empty', async () => {
    const result = await refineTextWithGemini('', 'api-key');
    expect(result).toBe('');
  });

  it('returns original text for very short texts (2 words or less)', async () => {
    const text = 'hello';
    const result = await refineTextWithGemini(text, 'api-key');
    expect(result).toBe(text);
  });

  it('skips refinement for code-like content', async () => {
    const codeText = 'function test() { return true; }';
    const result = await refineTextWithGemini(codeText, 'api-key');
    expect(result).toBe(codeText);
  });

  it('skips refinement for URLs', async () => {
    const urlText = 'check out https://example.com for more info';
    const result = await refineTextWithGemini(urlText, 'api-key');
    expect(result).toBe(urlText);
  });

  it('skips refinement for emails', async () => {
    const emailText = 'contact me at user@example.com please';
    const result = await refineTextWithGemini(emailText, 'api-key');
    expect(result).toBe(emailText);
  });

  it('calls Gemini API for normal text', async () => {
    // Mock response must be similar enough to pass similarity check (>60%)
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{ text: 'Hello world, this is a test.' }]
          }
        }]
      })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const text = 'hello world this is a test';
    const result = await refineTextWithGemini(text, 'test-api-key');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Result should be the refined text (similar enough to pass)
    expect(result).toBe('Hello world, this is a test.');
  });

  it('returns original text when API returns error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const text = 'hello world this is a test';
    const result = await refineTextWithGemini(text, 'test-api-key');

    expect(result).toBe(text);
  });

  it('returns original text when similarity is too low', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{ text: 'Completely different unrelated text that AI made up' }]
          }
        }]
      })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const text = 'hello world this is a test';
    const result = await refineTextWithGemini(text, 'test-api-key');

    // Should reject due to low similarity
    expect(result).toBe(text);
  });

  it('returns original text when refined text is much longer', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              text: 'Hello world this is a test. Here is a lot more text that the AI added. And even more text. And more and more and more text that makes this way too long.'
            }]
          }
        }]
      })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const text = 'hello world this is a test';
    const result = await refineTextWithGemini(text, 'test-api-key');

    // Should reject due to length increase
    expect(result).toBe(text);
  });

  it('handles network timeout gracefully', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    const text = 'hello world this is a test';
    const result = await refineTextWithGemini(text, 'test-api-key');

    expect(result).toBe(text);
  });

  it('includes context template in system instruction when provided', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{ text: 'Hello world, this is a test.' }]
          }
        }]
      })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const text = 'hello world this is a test';
    const template = 'Format as professional business communication.';
    await refineTextWithGemini(text, 'test-api-key', 'gemini-2.0-flash', template);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const instruction = getSystemInstruction(global.fetch as ReturnType<typeof vi.fn>);
    expect(instruction).toContain('ADDITIONAL CONTEXT:');
    expect(instruction).toContain(template);
  });

  it('does not include ADDITIONAL CONTEXT when no template provided', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{ text: 'Hello world, this is a test.' }]
          }
        }]
      })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const text = 'hello world this is a test';
    await refineTextWithGemini(text, 'test-api-key');

    const instruction = getSystemInstruction(global.fetch as ReturnType<typeof vi.fn>);
    expect(instruction).not.toContain('ADDITIONAL CONTEXT:');
  });
});
