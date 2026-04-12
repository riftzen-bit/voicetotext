/**
 * Text Formatter - Local text formatting rules applied after transcription
 */

export interface FormattingOptions {
  autoCapitalize: boolean;
  smartPunctuation: boolean;
  smartQuotes: boolean;
  numberFormatting: "digits" | "words" | "auto";
  listDetection: boolean;
  trimWhitespace: boolean;
}

export const DEFAULT_FORMATTING: FormattingOptions = {
  autoCapitalize: true,
  smartPunctuation: true,
  smartQuotes: false,
  numberFormatting: "auto",
  listDetection: true,
  trimWhitespace: true,
};

/**
 * Capitalize first letter of sentences
 */
function autoCapitalize(text: string): string {
  // Match start of text or after sentence-ending punctuation
  return text.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_, prefix, letter) => prefix + letter.toUpperCase()
  );
}

/**
 * Apply smart punctuation rules
 */
function smartPunctuation(text: string): string {
  let result = text;

  // Fix double spaces
  result = result.replace(/\s{2,}/g, " ");

  // Add space after punctuation if missing
  result = result.replace(/([.!?,;:])([A-Za-z])/g, "$1 $2");

  // Remove space before punctuation
  result = result.replace(/\s+([.!?,;:])/g, "$1");

  // Fix ellipsis
  result = result.replace(/\.{2,}/g, "...");

  // Em-dash from double hyphen
  result = result.replace(/\s--\s/g, " — ");
  result = result.replace(/--/g, "—");

  return result;
}

/**
 * Convert straight quotes to curly quotes
 */
function smartQuotes(text: string): string {
  let result = text;

  // IMPORTANT: Process apostrophes FIRST (before quote pairs)
  // This prevents "It's a 'test'" from matching 's a ' as a quoted string
  result = result.replace(/(\w)'(\w)/g, "$1\u2019$2"); // Apostrophes in contractions

  // Double quotes - using Unicode code points
  result = result.replace(/"([^"]+)"/g, "\u201C$1\u201D");

  // Single quotes (now safe to process since apostrophes are already converted)
  result = result.replace(/'([^'\u2019]+)'/g, "\u2018$1\u2019");

  return result;
}

// Number words for conversion
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000, million: 1000000, billion: 1000000000,
};

const DIGITS_TO_WORDS: Record<number, string> = {
  0: "zero", 1: "one", 2: "two", 3: "three", 4: "four",
  5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
  10: "ten", 11: "eleven", 12: "twelve",
};

// Pre-compiled regexes for number conversion (avoid re-compilation per call)
const NUMBER_WORD_REGEXES: Array<{ regex: RegExp; replacement: string }> =
  Object.entries(NUMBER_WORDS).map(([word, num]) => ({
    regex: new RegExp(`\\b${word}\\b`, "gi"),
    replacement: String(num),
  }));

const DIGIT_TO_WORD_REGEXES: Array<{ regex: RegExp; replacement: string }> =
  Object.entries(DIGITS_TO_WORDS).map(([num, word]) => ({
    regex: new RegExp(`\\b${num}\\b`, "g"),
    replacement: word,
  }));

/**
 * Convert number words to digits
 */
function wordsToDigits(text: string): string {
  let result = text;
  for (const { regex, replacement } of NUMBER_WORD_REGEXES) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Convert small digits to words (for formal text)
 */
function digitsToWords(text: string): string {
  let result = text;
  for (const { regex, replacement } of DIGIT_TO_WORD_REGEXES) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Auto number formatting - digits for technical, words for prose
 */
function autoNumberFormat(text: string): string {
  // Heuristic: if text contains technical indicators, use digits
  const technicalPatterns = [
    /\d+\.\d+/, // Decimals
    /\d+%/, // Percentages
    /\d+(?:px|em|rem|pt)\b/, // CSS units (must have digits before unit)
    /\$\d+|\d+\$/, // Currency
    /\d+:\d+/, // Time
    /\d+\/\d+/, // Fractions/dates
    /v\d+/i, // Versions
  ];

  const isTechnical = technicalPatterns.some((p) => p.test(text));

  if (isTechnical) {
    return wordsToDigits(text);
  }

  // For prose, keep numbers as-is (don't convert)
  return text;
}

/**
 * Detect and format lists
 */
function formatLists(text: string): string {
  const lines = text.split("\n");
  let inList = false;
  let listIndex = 0;

  const formatted = lines.map((line) => {
    const trimmed = line.trim();

    // Detect list patterns
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)/);
    const numberMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    const letterMatch = trimmed.match(/^([a-z])[.)]\s+(.+)/i);

    if (bulletMatch) {
      inList = true;
      return `• ${bulletMatch[1]}`;
    }

    if (numberMatch) {
      if (!inList) {
        inList = true;
        listIndex = parseInt(numberMatch[1], 10);
      }
      const content = numberMatch[2];
      const result = `${listIndex}. ${content}`;
      listIndex++;
      return result;
    }

    if (letterMatch) {
      inList = true;
      return `${letterMatch[1].toLowerCase()}) ${letterMatch[2]}`;
    }

    // End of list
    if (trimmed === "" || (!bulletMatch && !numberMatch && !letterMatch)) {
      inList = false;
      listIndex = 0;
    }

    return line;
  });

  return formatted.join("\n");
}

/**
 * Apply all formatting rules based on options
 */
export function formatText(text: string, options: Partial<FormattingOptions> = {}): string {
  const opts = { ...DEFAULT_FORMATTING, ...options };
  let result = text;

  // Trim whitespace first
  if (opts.trimWhitespace) {
    result = result.trim();
  }

  // Smart punctuation BEFORE capitalize (fixes spacing so capitalize can work)
  if (opts.smartPunctuation) {
    result = smartPunctuation(result);
  }

  // Auto-capitalize sentences (now spacing is normalized)
  if (opts.autoCapitalize) {
    result = autoCapitalize(result);
  }

  // Smart quotes
  if (opts.smartQuotes) {
    result = smartQuotes(result);
  }

  // Number formatting
  switch (opts.numberFormatting) {
    case "digits":
      result = wordsToDigits(result);
      break;
    case "words":
      result = digitsToWords(result);
      break;
    case "auto":
      result = autoNumberFormat(result);
      break;
  }

  // List detection
  if (opts.listDetection) {
    result = formatLists(result);
  }

  return result;
}

/**
 * Preview formatting changes without applying
 */
export function previewFormatting(
  text: string,
  options: Partial<FormattingOptions> = {}
): { before: string; after: string; changes: string[] } {
  const after = formatText(text, options);
  const changes: string[] = [];

  if (text !== after) {
    // If lowercase versions are SAME but originals DIFFER, it's a case change
    if (text.toLowerCase() === after.toLowerCase() && text !== after) {
      changes.push("Capitalization");
    }
    // Normalize whitespace and quotes for punctuation comparison
    const normalizeForPunct = (s: string) => s.replace(/\s+/g, " ").replace(/[\u201C\u201D\u2018\u2019]/g, '"\'');
    if (normalizeForPunct(text.toLowerCase()) !== normalizeForPunct(after.toLowerCase())) {
      changes.push("Punctuation");
    }
    if (/\d/.test(text) !== /\d/.test(after)) {
      changes.push("Number formatting");
    }
  }

  return { before: text, after, changes };
}
