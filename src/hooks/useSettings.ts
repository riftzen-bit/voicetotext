import { useCallback, useEffect, useState } from "react";
import { getApi, ModelCatalogEntry, ModelCatalogInfo } from "../lib/ipc";

const FALLBACK_MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    value: "large-v3",
    label: "large-v3",
    description: "Best accuracy, multilingual",
    size_mb: 3100,
    recommended: true,
  },
  {
    value: "distil-large-v3",
    label: "distil-large-v3",
    description: "Faster large multilingual model",
    size_mb: 1500,
    recommended: true,
  },
  {
    value: "medium",
    label: "medium",
    description: "Balanced speed and quality",
    size_mb: 1500,
    recommended: true,
  },
  {
    value: "small",
    label: "small",
    description: "Fast multilingual model",
    size_mb: 466,
    recommended: true,
  },
];

export interface AppSettings {
  hotkeyMode: "ptt" | "ttt";
  hotkey: string;
  cancelHotkey: string;
  autoPaste: boolean;
  // When false, the user's clipboard is preserved across a paste: we stash the
  // previous clipboard, write the transcript, fire Ctrl+V, then restore the
  // original. When true, the transcript stays on the clipboard after paste.
  copyToClipboard: boolean;
  audioDevice: string;
  modelSize: string;
  transcriptionProfile: "fast" | "balanced" | "accurate";
  languageHint: string;
  overlayPosition: { x: number; y: number };
  useGemini: boolean;
  geminiApiKey: string;
  geminiModel: string;
  // Two-step pipeline mode. "off" disables the backend pipeline entirely
  // (falling back to the legacy single-shot `useGemini` polish). The other
  // three values drive ai_pipeline.refine_stream on the backend.
  aiMode: "off" | "refine" | "translate" | "summarize-translate";
  // BCP-47 code of the language the final text should appear in. The source
  // language is taken from Whisper's detection at transcription time.
  uiLanguage: string;
  appearance?: Record<string, unknown>;
  // Audio enhancement settings
  noiseGateEnabled: boolean;
  noiseGateThresholdDb: number;
  audioNormalizeEnabled: boolean;
  audioNormalizeTargetDb: number;
  // Context templates for AI refinement.
  // `mode` distinguishes polish (voice cleanup + style hint) from agent
  // (persona replaces system prompt). Older saved settings without `mode`
  // fall back to "polish" at read time.
  contextTemplates?: Array<{
    id: string;
    name: string;
    prompt: string;
    order: number;
    mode?: "polish" | "agent";
    description?: string;
  }>;
  activeTemplateId?: string | null;
  // Code mode - skip AI refinement
  codeMode?: boolean;
  codeModeHotkey?: string;
  // Adaptive model selection
  adaptiveModelEnabled?: boolean;
  lastSystemMetrics?: Record<string, unknown> | null;
  // Smart formatting options
  formatting?: {
    autoCapitalize: boolean;
    smartPunctuation: boolean;
    smartQuotes: boolean;
    numberFormatting: "digits" | "words" | "auto";
    listDetection: boolean;
    trimWhitespace: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  hotkeyMode: "ptt",
  hotkey: "CommandOrControl+Shift+R",
  cancelHotkey: "Escape",
  autoPaste: true,
  copyToClipboard: true,
  audioDevice: "default",
  modelSize: "large-v3",
  transcriptionProfile: "balanced",
  languageHint: "auto",
  overlayPosition: { x: -1, y: -1 },
  useGemini: false,
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  aiMode: "off",
  uiLanguage: "en",
  noiseGateEnabled: true,
  noiseGateThresholdDb: -40,
  audioNormalizeEnabled: true,
  audioNormalizeTargetDb: -3,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogEntry[]>(FALLBACK_MODEL_CATALOG);
  const [defaultModel, setDefaultModel] = useState(DEFAULT_SETTINGS.modelSize);

  useEffect(() => {
    const api = getApi();
    if (!api) {
      setLoaded(true);
      return;
    }

    api.getSettings().then((s) => {
      setSettings({ ...DEFAULT_SETTINGS, ...s } as AppSettings);
      setLoaded(true);
    });

    api.getModelCatalog().then((catalog) => {
      const typedCatalog = catalog as ModelCatalogInfo;
      setDefaultModel(typedCatalog.default_model || DEFAULT_SETTINGS.modelSize);
      setModelCatalog(
        typedCatalog.models && typedCatalog.models.length > 0
          ? typedCatalog.models
          : FALLBACK_MODEL_CATALOG
      );
    });

    const unsub = api.onSettingsChanged((nextSettings) => {
      setSettings((prev) => ({ ...prev, ...nextSettings } as AppSettings));
    });

    return () => {
      unsub();
    };
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const api = getApi();
      if (api) {
        await api.setSetting(key, value);
      }
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return { settings, loaded, updateSetting, modelCatalog, defaultModel };
}
