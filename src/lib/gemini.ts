const BASE_REFINEMENT_PROMPT = `You are a voice transcription post-processor. Your ONLY job is to lightly polish speech-to-text output.

RULES:
1. FIX ONLY: spelling errors, punctuation, capitalization
2. PRESERVE: original meaning, intent, tone, structure, and language
3. NEVER: add new content, change meaning, translate, or rewrite sentences
4. If the text looks intentional (technical terms, names, code), DO NOT change it
5. If you're unsure, return the text UNCHANGED
6. Keep the SAME language as input - do not translate

OUTPUT: Return ONLY the polished text with no explanations, prefixes, or formatting.`;

/**
 * Build the full refinement prompt with optional context template
 */
function buildRefinementPrompt(contextTemplate?: string): string {
  if (!contextTemplate) {
    return BASE_REFINEMENT_PROMPT;
  }
  return `${BASE_REFINEMENT_PROMPT}

ADDITIONAL CONTEXT:
${contextTemplate}`;
}

/**
 * Calculate similarity ratio between two strings (0-1)
 * Uses Levenshtein-like character matching
 */
function calculateSimilarity(original: string, refined: string): number {
  const s1 = original.toLowerCase().trim();
  const s2 = refined.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // For short texts, be more lenient
  const minLen = Math.min(s1.length, s2.length);
  const maxLen = Math.max(s1.length, s2.length);

  // Length ratio check - if lengths differ too much, likely AI rewrote
  const lengthRatio = minLen / maxLen;
  if (lengthRatio < 0.5) return lengthRatio;

  // Word-based similarity for longer texts
  const words1 = s1.split(/\s+/).filter(w => w.length > 0);
  const words2 = s2.split(/\s+/).filter(w => w.length > 0);

  if (words1.length === 0 || words2.length === 0) return lengthRatio;

  // Count matching words (order-independent for fuzzy match)
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  let matches = 0;

  for (const word of set1) {
    if (set2.has(word)) matches++;
  }

  const wordOverlap = (2 * matches) / (set1.size + set2.size);

  // Combine length ratio and word overlap
  return (lengthRatio * 0.3) + (wordOverlap * 0.7);
}

/**
 * Detect if text contains code-like patterns
 */
function hasCodePatterns(text: string): boolean {
  const codePatterns = [
    /[{}();=<>]/,                    // Code symbols
    /\b(function|const|let|var|class|import|export)\b/,
    /\b(if|else|for|while|return|async|await)\b/,
    /\.(js|ts|py|java|cpp|html|css)\b/i,
    /https?:\/\//,                   // URLs
    /\w+@\w+\.\w+/,                  // Emails
    /[A-Z][a-z]+[A-Z]/,              // CamelCase
    /_[a-z]+_/,                      // snake_case markers
  ];

  return codePatterns.some(pattern => pattern.test(text));
}

export async function refineTextWithGemini(
  text: string,
  apiKey: string,
  modelId: string = "gemini-3.1-flash-lite-preview",
  contextTemplate?: string
): Promise<string> {
  if (!apiKey || !text || text.trim().length === 0) return text;

  // Skip refinement for very short texts (likely commands or single words)
  if (text.trim().split(/\s+/).length <= 2) {
    return text;
  }

  // Skip refinement for code-like content
  if (hasCodePatterns(text)) {
    console.log("Skipping AI refinement: detected code-like patterns");
    return text;
  }

  // Scale budgets with input size so long dictations don't hit the 8s / 512-token
  // ceilings and either abort or come back truncated. Rough token estimate: 3 chars/token.
  const estInputTokens = Math.ceil(text.length / 3);
  const maxOutputTokens = Math.min(8192, Math.max(512, estInputTokens + 256));
  const timeoutMs = Math.min(60_000, Math.max(8_000, Math.ceil(text.length / 50) * 1000));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildRefinementPrompt(contextTemplate) }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: text }],
            },
          ],
          generationConfig: {
            temperature: 0.05,  // Lower temperature for more consistent output
            maxOutputTokens,
            topP: 0.9,
          },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("Gemini API error:", response.status, response.statusText);
      return text;
    }

    const data = await response.json();
    const refined = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!refined || refined.length === 0) {
      return text;
    }

    // Safety check: Compare similarity between original and refined
    const similarity = calculateSimilarity(text, refined);

    // If similarity is too low, AI likely misunderstood or rewrote too much
    // Threshold: 0.6 means at least 60% similar
    if (similarity < 0.6) {
      console.warn(
        `AI refinement rejected: similarity ${(similarity * 100).toFixed(1)}% too low. ` +
        `Original: "${text.slice(0, 50)}..." Refined: "${refined.slice(0, 50)}..."`
      );
      return text;
    }

    // Also reject if refined text is much longer (AI added content)
    if (refined.length > text.length * 1.5) {
      console.warn("AI refinement rejected: output significantly longer than input");
      return text;
    }

    return refined;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("Gemini refinement timed out, using original text");
    } else {
      console.error("Gemini refinement failed:", err);
    }
    return text;
  }
}
