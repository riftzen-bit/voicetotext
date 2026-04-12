import { useCallback, useEffect, useState } from "react";
import { getApi, Keyword } from "../lib/ipc";

/**
 * Hook for managing keywords (vocabulary corrections).
 * Provides CRUD operations and real-time sync via IPC.
 */
export function useKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const api = getApi();
    if (!api) {
      setLoaded(true);
      return;
    }

    // Load initial keywords
    api.getKeywords().then((kws) => {
      setKeywords(kws || []);
      setLoaded(true);
    });

    // Subscribe to changes
    const unsubKeywords = api.onKeywordsChanged((kws) => {
      setKeywords(kws || []);
    });

    return () => {
      unsubKeywords();
    };
  }, []);

  const addKeyword = useCallback(
    async (
      trigger: string,
      correction: string,
      options?: {
        caseSensitive?: boolean;
        wholeWord?: boolean;
        source?: "manual" | "learned";
      }
    ) => {
      const api = getApi();
      if (!api) return null;

      setLoading(true);
      try {
        const result = await api.addKeyword({
          trigger,
          correction,
          caseSensitive: options?.caseSensitive ?? false,
          wholeWord: options?.wholeWord ?? true,
          source: options?.source ?? "manual",
        });
        return result;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateKeyword = useCallback(
    async (id: string, partial: Partial<Omit<Keyword, "id" | "createdAt">>) => {
      const api = getApi();
      if (!api) return null;

      setLoading(true);
      try {
        return await api.updateKeyword(id, partial);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteKeyword = useCallback(async (id: string) => {
    const api = getApi();
    if (!api) return false;

    setLoading(true);
    try {
      return await api.deleteKeyword(id);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyKeywords = useCallback(async (text: string) => {
    const api = getApi();
    if (!api) return { text, appliedCount: 0 };
    return await api.applyKeywords(text);
  }, []);

  const clearKeywords = useCallback(async () => {
    const api = getApi();
    if (!api) return;

    setLoading(true);
    try {
      await api.clearKeywords();
    } finally {
      setLoading(false);
    }
  }, []);

  const importKeywords = useCallback(
    async (kws: Array<Omit<Keyword, "id" | "usageCount" | "createdAt">>) => {
      const api = getApi();
      if (!api) return 0;

      setLoading(true);
      try {
        return await api.importKeywords(kws);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const exportKeywords = useCallback(async () => {
    const api = getApi();
    if (!api) return [];
    return await api.exportKeywords();
  }, []);

  return {
    keywords,
    loaded,
    loading,
    addKeyword,
    updateKeyword,
    deleteKeyword,
    applyKeywords,
    clearKeywords,
    importKeywords,
    exportKeywords,
  };
}
