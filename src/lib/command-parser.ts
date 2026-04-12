/**
 * Command Parser - Detects and parses voice commands from transcription
 */

export type CommandType =
  | "navigation"
  | "settings"
  | "model"
  | "history"
  | "mode"
  | "unknown";

export interface ParsedCommand {
  type: CommandType;
  action: string;
  args: string[];
  confidence: number;
  originalText: string;
}

export interface CommandPattern {
  type: CommandType;
  action: string;
  patterns: RegExp[];
  extractArgs?: (match: RegExpMatchArray) => string[];
}

// Command patterns with regex matchers
const COMMAND_PATTERNS: CommandPattern[] = [
  // Navigation commands
  {
    type: "navigation",
    action: "open_settings",
    patterns: [
      /^(open|show|go to)\s+(settings|preferences|options)$/i,
      /^settings$/i,
    ],
  },
  {
    type: "navigation",
    action: "open_history",
    patterns: [
      /^(open|show|go to)\s+(history|transcript|transcripts)$/i,
      /^history$/i,
    ],
  },
  {
    type: "navigation",
    action: "open_templates",
    patterns: [
      /^(open|show|go to)\s+templates$/i,
      /^templates$/i,
    ],
  },
  {
    type: "navigation",
    action: "open_shortcuts",
    patterns: [
      /^(open|show|go to)\s+(shortcuts|hotkeys|keyboard)$/i,
      /^shortcuts$/i,
    ],
  },
  {
    type: "navigation",
    action: "go_home",
    patterns: [
      /^(go\s+)?(home|back|main)$/i,
    ],
  },

  // Settings commands
  {
    type: "settings",
    action: "toggle_dark_mode",
    patterns: [
      /^(switch to|enable|turn on)\s+dark\s+(mode|theme)$/i,
      /^dark\s+(mode|theme)$/i,
    ],
  },
  {
    type: "settings",
    action: "toggle_light_mode",
    patterns: [
      /^(switch to|enable|turn on)\s+light\s+(mode|theme)$/i,
      /^light\s+(mode|theme)$/i,
    ],
  },
  {
    type: "settings",
    action: "toggle_system_theme",
    patterns: [
      /^(switch to|use)\s+system\s+(theme|mode)$/i,
      /^system\s+(theme|mode)$/i,
    ],
  },

  // Mode commands - MUST come before model commands to prevent greedy matching
  // "switch to push to talk" would otherwise match load_model's "switch to" pattern
  {
    type: "mode",
    action: "toggle_ptt",
    patterns: [
      /^(switch\s+to|use)\s+push\s+to\s+talk$/i,
      /^push\s+to\s+talk$/i,
      /^ptt$/i,
    ],
  },
  {
    type: "mode",
    action: "toggle_ttt",
    patterns: [
      /^(switch\s+to|use)\s+toggle\s+to\s+talk$/i,
      /^toggle\s+to\s+talk$/i,
      /^ttt$/i,
    ],
  },

  // Model commands
  {
    type: "model",
    action: "load_model",
    patterns: [
      /^(load|switch to|use)\s+(model\s+)?(.+)$/i,
    ],
    extractArgs: (match) => [match[3]?.trim() || ""],
  },
  {
    type: "model",
    action: "download_model",
    patterns: [
      /^download\s+(model\s+)?(.+)$/i,
    ],
    extractArgs: (match) => [match[2]?.trim() || ""],
  },

  // History commands
  {
    type: "history",
    action: "clear_history",
    patterns: [
      /^clear\s+(all\s+)?(history|transcripts?)$/i,
      /^delete\s+all\s+(history|transcripts?)$/i,
    ],
  },
  {
    type: "history",
    action: "copy_last",
    patterns: [
      /^copy\s+(the\s+)?(last|previous)\s+(entry|transcript)?$/i,
      /^copy\s+last$/i,
    ],
  },

  // Mode commands - order matters, more specific patterns first
  {
    type: "mode",
    action: "enable_code_mode",
    patterns: [
      /^(enable|turn on|start)\s+code\s+mode$/i,
      /^code\s+mode\s+on$/i,
    ],
  },
  {
    type: "mode",
    action: "disable_code_mode",
    patterns: [
      /^(disable|turn off|stop)\s+code\s+mode$/i,
      /^code\s+mode\s+off$/i,
    ],
  },
  {
    type: "mode",
    action: "toggle_code_mode",
    patterns: [
      /^toggle\s+code\s+mode$/i,
    ],
  },
];

// Command trigger phrases that indicate a voice command
const COMMAND_TRIGGERS = [
  /^(hey\s+)?voice\s+(to\s+text\s+)?/i,
  /^(hey\s+)?vtt\s+/i,
  /^computer\s+/i,
  /^command\s+/i,
];

/**
 * Check if text starts with a command trigger
 */
export function hasCommandTrigger(text: string): boolean {
  const trimmed = text.trim();
  return COMMAND_TRIGGERS.some((trigger) => trigger.test(trimmed));
}

/**
 * Remove command trigger from text
 */
export function removeCommandTrigger(text: string): string {
  let result = text.trim();
  for (const trigger of COMMAND_TRIGGERS) {
    result = result.replace(trigger, "").trim();
  }
  return result;
}

/**
 * Parse text into a command if it matches any pattern
 */
export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim().toLowerCase();

  // Check if text is too long to be a command (commands are typically short)
  if (trimmed.split(/\s+/).length > 10) {
    return null;
  }

  // Remove command trigger if present
  const commandText = removeCommandTrigger(trimmed);

  // Try to match against patterns
  for (const pattern of COMMAND_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = commandText.match(regex);
      if (match) {
        const args = pattern.extractArgs ? pattern.extractArgs(match) : [];

        // Calculate confidence based on match quality
        const confidence = calculateConfidence(commandText, regex, match);

        return {
          type: pattern.type,
          action: pattern.action,
          args,
          confidence,
          originalText: text,
        };
      }
    }
  }

  return null;
}

/**
 * Calculate confidence score for a command match
 */
function calculateConfidence(text: string, pattern: RegExp, match: RegExpMatchArray): number {
  // Start with base confidence
  let confidence = 0.7;

  // Boost for exact match (match covers entire text)
  if (match[0].length === text.length) {
    confidence += 0.2;
  }

  // Boost for command trigger presence
  if (hasCommandTrigger(text)) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Check if text looks like a command (heuristic)
 */
export function looksLikeCommand(text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  // Check for command trigger
  if (hasCommandTrigger(trimmed)) {
    return true;
  }

  // Check for imperative verb starts
  const imperativeStarts = [
    "open", "show", "go", "switch", "toggle", "enable", "disable",
    "load", "download", "clear", "delete", "copy", "use", "turn",
  ];

  const firstWord = trimmed.split(/\s+/)[0];
  return imperativeStarts.includes(firstWord);
}

// Pre-computed available commands (static, never changes at runtime)
const AVAILABLE_COMMANDS: Record<CommandType, string[]> = (() => {
  const commands: Record<CommandType, Set<string>> = {
    navigation: new Set(),
    settings: new Set(),
    model: new Set(),
    history: new Set(),
    mode: new Set(),
    unknown: new Set(),
  };
  for (const pattern of COMMAND_PATTERNS) {
    commands[pattern.type].add(pattern.action);
  }
  return {
    navigation: Array.from(commands.navigation),
    settings: Array.from(commands.settings),
    model: Array.from(commands.model),
    history: Array.from(commands.history),
    mode: Array.from(commands.mode),
    unknown: [],
  };
})();

/**
 * Get all available commands grouped by type
 */
export function getAvailableCommands(): Record<CommandType, string[]> {
  return AVAILABLE_COMMANDS;
}
