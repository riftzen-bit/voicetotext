// Seed templates. Two modes:
//
//   polish → wrapped into the base voice-cleanup system prompt as an
//            ADDITIONAL CONTEXT block. Gemini only fixes spelling /
//            punctuation / casing and honors the style hint.
//
//   agent  → the prompt BECOMES the full system prompt. The transcript is
//            the user's request. Gemini acts as the persona and responds
//            however best fits the dictation (no similarity guard).
//
// Prompts are DELIBERATELY tiny — one sentence, sometimes two.
// A long prompt with rules, sections, and output formats actively hurts:
// the persona signal gets diluted and the model stops adapting to what the
// user actually dictated. A single-line persona is stronger: the model
// reads the transcript, infers what the user wants, and formats itself.
//
// All prompts are English. Gemini follows English instructions regardless
// of the source audio language. Vietnamese polish is the one exception.
export type TemplateMode = "polish" | "agent";

export interface ContextTemplate {
  id: string;
  name: string;
  prompt: string;
  order: number;
  /** Defaults to "polish" when omitted so older saved settings keep working. */
  mode?: TemplateMode;
  /** Short one-liner shown on the template card. */
  description?: string;
}

export const DEFAULT_TEMPLATES: ContextTemplate[] = [
  {
    id: "professional",
    name: "Professional",
    mode: "polish",
    description: "Formal business tone.",
    prompt:
      "Clean up the dictation as a professional business note. Preserve the speaker's intent.",
    order: 0,
  },
  {
    id: "casual",
    name: "Casual",
    mode: "polish",
    description: "Friendly, contractions allowed.",
    prompt:
      "Clean up the dictation as a casual, friendly note. Contractions are fine.",
    order: 1,
  },
  {
    id: "coder",
    name: "Coder",
    mode: "agent",
    description: "Senior engineer. Dictate the request, get the answer.",
    prompt:
      "You are a senior software engineer. The user dictated a code-related request — read it and respond with working code or a direct answer.",
    order: 2,
  },
  {
    id: "debugger",
    name: "Debugger",
    mode: "agent",
    description: "Finds the root cause and proposes a fix.",
    prompt:
      "You are a staff debugger. The user dictated a bug or failure — read it and help them fix it.",
    order: 3,
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    mode: "agent",
    description: "Reviews dictated changes like a principal engineer.",
    prompt:
      "You are a principal engineer doing code review. The user dictated what they changed — review it like a sharp, kind teammate.",
    order: 4,
  },
  {
    id: "email",
    name: "Email",
    mode: "polish",
    description: "Shape into an email.",
    prompt: "Shape the dictation into a clear, polite email.",
    order: 5,
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    mode: "polish",
    description: "Shape into meeting notes.",
    prompt:
      "Shape the dictation into clean meeting notes. Drop filler and small talk.",
    order: 6,
  },
  {
    id: "design-note",
    name: "Design Note",
    mode: "polish",
    description: "Shape into a design note.",
    prompt:
      "Shape the dictation into a design note. Preserve design vocabulary precisely.",
    order: 7,
  },
  {
    id: "bullet-summary",
    name: "Bullet Summary",
    mode: "polish",
    description: "Condense into short bullets.",
    prompt:
      "Condense the dictation into a few short bullet points. Keep concrete nouns and numbers.",
    order: 8,
  },
  {
    id: "quick-note",
    name: "Quick Note",
    mode: "polish",
    description: "Light cleanup, keeps your exact words.",
    prompt:
      "Clean the dictation into a readable note. Fix punctuation only. Preserve the speaker's words and order.",
    order: 9,
  },
];
