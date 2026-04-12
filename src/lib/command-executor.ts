/**
 * Command Executor - Executes parsed voice commands
 */

import { ParsedCommand } from "./command-parser";
import { getApi } from "./ipc";

export interface CommandResult {
  success: boolean;
  message: string;
  action?: string;
}

export type NavigationTarget =
  | "general"
  | "ai"
  | "templates"
  | "formatting"
  | "history"
  | "analytics"
  | "phrases"
  | "keywords"
  | "shortcuts"
  | "export"
  | "appearance"
  | "about";

// Callback type for navigation
type NavigationCallback = (target: NavigationTarget) => void;

// Callback type for settings
type SettingsCallback = (key: string, value: unknown) => Promise<void>;

// Store callbacks for command execution
let navigationCallback: NavigationCallback | null = null;
let settingsCallback: SettingsCallback | null = null;

/**
 * Register navigation callback for command execution
 */
export function registerNavigationCallback(callback: NavigationCallback) {
  navigationCallback = callback;
}

/**
 * Register settings callback for command execution
 */
export function registerSettingsCallback(callback: SettingsCallback) {
  settingsCallback = callback;
}

/**
 * Execute a parsed command
 */
export async function executeCommand(command: ParsedCommand): Promise<CommandResult> {
  const api = getApi();

  switch (command.type) {
    case "navigation":
      return executeNavigationCommand(command);

    case "settings":
      return executeSettingsCommand(command);

    case "model":
      return executeModelCommand(command, api);

    case "history":
      return executeHistoryCommand(command, api);

    case "mode":
      return executeModeCommand(command, api);

    default:
      return {
        success: false,
        message: `Unknown command type: ${command.type}`,
      };
  }
}

// Static navigation action to target mapping
const NAVIGATION_MAP: Record<string, NavigationTarget> = {
  open_settings: "general",
  open_history: "history",
  open_templates: "templates",
  open_shortcuts: "shortcuts",
  go_home: "general",
};

/**
 * Execute navigation commands
 */
function executeNavigationCommand(command: ParsedCommand): CommandResult {
  if (!navigationCallback) {
    return {
      success: false,
      message: "Navigation not available",
    };
  }

  const target = NAVIGATION_MAP[command.action];
  if (target) {
    navigationCallback(target);
    return {
      success: true,
      message: `Navigated to ${target}`,
      action: command.action,
    };
  }

  return {
    success: false,
    message: `Unknown navigation target: ${command.action}`,
  };
}

/**
 * Execute settings commands
 */
async function executeSettingsCommand(command: ParsedCommand): Promise<CommandResult> {
  if (!settingsCallback) {
    return {
      success: false,
      message: "Settings not available",
    };
  }

  switch (command.action) {
    case "toggle_dark_mode":
      await settingsCallback("appearance", { theme: "dark" });
      return {
        success: true,
        message: "Switched to dark mode",
        action: command.action,
      };

    case "toggle_light_mode":
      await settingsCallback("appearance", { theme: "light" });
      return {
        success: true,
        message: "Switched to light mode",
        action: command.action,
      };

    case "toggle_system_theme":
      await settingsCallback("appearance", { theme: "system" });
      return {
        success: true,
        message: "Using system theme",
        action: command.action,
      };

    default:
      return {
        success: false,
        message: `Unknown settings action: ${command.action}`,
      };
  }
}

/**
 * Execute model commands
 */
async function executeModelCommand(
  command: ParsedCommand,
  api: ReturnType<typeof getApi>
): Promise<CommandResult> {
  if (!api) {
    return {
      success: false,
      message: "API not available",
    };
  }

  const modelArg = command.args[0]?.toLowerCase() || "";

  // Map common names to model IDs
  const modelMap: Record<string, string> = {
    tiny: "tiny",
    base: "base",
    small: "small",
    medium: "medium",
    large: "large-v3",
    "large v3": "large-v3",
    turbo: "large-v3-turbo",
    "large turbo": "large-v3-turbo",
    distil: "distil-large-v3",
    "distil large": "distil-large-v3",
  };

  const modelId = modelMap[modelArg] || modelArg;

  switch (command.action) {
    case "load_model":
      if (!modelId) {
        return {
          success: false,
          message: "No model specified",
        };
      }
      api.loadModel(modelId);
      return {
        success: true,
        message: `Loading model: ${modelId}`,
        action: command.action,
      };

    case "download_model":
      if (!modelId) {
        return {
          success: false,
          message: "No model specified",
        };
      }
      api.startModelDownload(modelId);
      return {
        success: true,
        message: `Downloading model: ${modelId}`,
        action: command.action,
      };

    default:
      return {
        success: false,
        message: `Unknown model action: ${command.action}`,
      };
  }
}

/**
 * Execute history commands
 */
async function executeHistoryCommand(
  command: ParsedCommand,
  api: ReturnType<typeof getApi>
): Promise<CommandResult> {
  if (!api) {
    return {
      success: false,
      message: "API not available",
    };
  }

  switch (command.action) {
    case "clear_history":
      api.clearHistory();
      return {
        success: true,
        message: "History cleared",
        action: command.action,
      };

    case "copy_last":
      const history = await api.getHistory();
      if (history.length > 0) {
        const lastEntry = history[0];
        await navigator.clipboard.writeText(lastEntry.text);
        return {
          success: true,
          message: "Copied last transcript",
          action: command.action,
        };
      }
      return {
        success: false,
        message: "No history to copy",
      };

    default:
      return {
        success: false,
        message: `Unknown history action: ${command.action}`,
      };
  }
}

/**
 * Execute mode commands
 */
async function executeModeCommand(
  command: ParsedCommand,
  api: ReturnType<typeof getApi>
): Promise<CommandResult> {
  if (!api || !settingsCallback) {
    return {
      success: false,
      message: "API not available",
    };
  }

  switch (command.action) {
    case "toggle_code_mode":
      const settings = await api.getSettings();
      const newCodeMode = !settings.codeMode;
      await settingsCallback("codeMode", newCodeMode);
      return {
        success: true,
        message: `Code mode ${newCodeMode ? "enabled" : "disabled"}`,
        action: command.action,
      };

    case "enable_code_mode":
      await settingsCallback("codeMode", true);
      return {
        success: true,
        message: "Code mode enabled",
        action: command.action,
      };

    case "disable_code_mode":
      await settingsCallback("codeMode", false);
      return {
        success: true,
        message: "Code mode disabled",
        action: command.action,
      };

    case "toggle_ptt":
      await settingsCallback("hotkeyMode", "ptt");
      return {
        success: true,
        message: "Switched to Push-to-Talk mode",
        action: command.action,
      };

    case "toggle_ttt":
      await settingsCallback("hotkeyMode", "ttt");
      return {
        success: true,
        message: "Switched to Toggle-to-Talk mode",
        action: command.action,
      };

    default:
      return {
        success: false,
        message: `Unknown mode action: ${command.action}`,
      };
  }
}
