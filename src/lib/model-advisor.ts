/**
 * Model Advisor - Recommends optimal Whisper model based on system capabilities
 */

export interface SystemMetrics {
  // GPU info
  hasGpu: boolean;
  gpuName?: string;
  vramMb?: number;
  cudaAvailable?: boolean;

  // CPU info
  cpuCores: number;
  cpuModel?: string;

  // Memory
  totalRamMb: number;
  availableRamMb: number;

  // Platform
  platform: "win32" | "darwin" | "linux";
  arch: "x64" | "arm64" | "ia32";
}

export interface ModelInfo {
  id: string;
  name: string;
  sizeMb: number;
  minVramMb: number;
  minRamMb: number;
  quality: "low" | "medium" | "high" | "best";
  speed: "fast" | "medium" | "slow";
  languages: "english" | "multilingual";
}

export interface ModelRecommendation {
  recommended: string;
  reason: string;
  alternatives: Array<{
    model: string;
    reason: string;
  }>;
  warnings: string[];
}

// Model specifications based on Whisper model cards
export const MODEL_SPECS: Record<string, ModelInfo> = {
  "tiny": {
    id: "tiny",
    name: "Tiny",
    sizeMb: 75,
    minVramMb: 1000,
    minRamMb: 2000,
    quality: "low",
    speed: "fast",
    languages: "multilingual",
  },
  "base": {
    id: "base",
    name: "Base",
    sizeMb: 145,
    minVramMb: 1000,
    minRamMb: 2000,
    quality: "low",
    speed: "fast",
    languages: "multilingual",
  },
  "small": {
    id: "small",
    name: "Small",
    sizeMb: 488,
    minVramMb: 2000,
    minRamMb: 4000,
    quality: "medium",
    speed: "medium",
    languages: "multilingual",
  },
  "medium": {
    id: "medium",
    name: "Medium",
    sizeMb: 1500,
    minVramMb: 4000,
    minRamMb: 8000,
    quality: "high",
    speed: "medium",
    languages: "multilingual",
  },
  "large-v3": {
    id: "large-v3",
    name: "Large V3",
    sizeMb: 3100,
    minVramMb: 6000,
    minRamMb: 10000,
    quality: "best",
    speed: "slow",
    languages: "multilingual",
  },
  "large-v3-turbo": {
    id: "large-v3-turbo",
    name: "Large V3 Turbo",
    sizeMb: 1600,
    minVramMb: 4000,
    minRamMb: 8000,
    quality: "best",
    speed: "medium",
    languages: "multilingual",
  },
  "distil-large-v3": {
    id: "distil-large-v3",
    name: "Distil Large V3",
    sizeMb: 1500,
    minVramMb: 4000,
    minRamMb: 8000,
    quality: "high",
    speed: "fast",
    languages: "english",
  },
};

/**
 * Detect platform from browser environment
 */
function detectPlatform(): SystemMetrics["platform"] {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "win32";
  if (ua.includes("mac")) return "darwin";
  return "linux";
}

/**
 * Detect architecture from browser environment
 */
function detectArch(): SystemMetrics["arch"] {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("arm64") || ua.includes("aarch64")) return "arm64";
  if (ua.includes("x64") || ua.includes("x86_64") || ua.includes("amd64")) return "x64";
  return "x64"; // Default fallback
}

/**
 * Get default system metrics when actual metrics are unavailable
 */
export function getDefaultMetrics(): SystemMetrics {
  return {
    hasGpu: false,
    cpuCores: navigator.hardwareConcurrency || 4,
    totalRamMb: 8000, // Conservative default
    availableRamMb: 4000,
    platform: detectPlatform(),
    arch: detectArch(),
  };
}

/**
 * Recommend optimal model based on system metrics
 */
export function recommendModel(metrics: SystemMetrics): ModelRecommendation {
  const warnings: string[] = [];
  const alternatives: Array<{ model: string; reason: string }> = [];

  // Determine available memory for model loading
  const availableVram = metrics.vramMb || 0;
  const availableRam = metrics.availableRamMb || metrics.totalRamMb * 0.5;

  // GPU path - prefer GPU acceleration
  if (metrics.hasGpu && metrics.cudaAvailable && availableVram > 0) {
    // High-end GPU (8GB+ VRAM)
    if (availableVram >= 8000) {
      alternatives.push({ model: "large-v3-turbo", reason: "Faster alternative with same quality" });
      return {
        recommended: "large-v3",
        reason: `High VRAM (${Math.round(availableVram / 1000)}GB) supports best quality model`,
        alternatives,
        warnings,
      };
    }

    // Mid-range GPU (6-8GB VRAM)
    if (availableVram >= 6000) {
      alternatives.push({ model: "large-v3", reason: "Best quality if speed is not critical" });
      alternatives.push({ model: "distil-large-v3", reason: "Faster, English-optimized" });
      return {
        recommended: "large-v3-turbo",
        reason: `Good VRAM (${Math.round(availableVram / 1000)}GB) - turbo offers best speed/quality balance`,
        alternatives,
        warnings,
      };
    }

    // Lower-mid GPU (4-6GB VRAM)
    if (availableVram >= 4000) {
      alternatives.push({ model: "large-v3-turbo", reason: "May work with some latency" });
      alternatives.push({ model: "small", reason: "Faster, lower quality" });
      return {
        recommended: "medium",
        reason: `Moderate VRAM (${Math.round(availableVram / 1000)}GB) - medium model recommended`,
        alternatives,
        warnings,
      };
    }

    // Low-end GPU (2-4GB VRAM)
    if (availableVram >= 2000) {
      alternatives.push({ model: "base", reason: "Lighter weight option" });
      return {
        recommended: "small",
        reason: `Limited VRAM (${Math.round(availableVram / 1000)}GB) - small model is optimal`,
        alternatives,
        warnings,
      };
    }

    // Very low VRAM (<2GB) - fall through to CPU
    warnings.push("GPU VRAM too low, recommending CPU-based model");
  }

  // CPU path - no usable GPU
  if (!metrics.hasGpu || !metrics.cudaAvailable) {
    warnings.push("No CUDA GPU detected - using CPU mode (slower)");
  }

  // High RAM system (16GB+)
  if (availableRam >= 10000) {
    alternatives.push({ model: "distil-large-v3", reason: "Faster alternative" });
    return {
      recommended: "large-v3-turbo",
      reason: "Sufficient RAM for turbo model on CPU",
      alternatives,
      warnings,
    };
  }

  // Medium RAM (8-16GB)
  if (availableRam >= 6000) {
    alternatives.push({ model: "small", reason: "Faster with slightly lower quality" });
    return {
      recommended: "medium",
      reason: "Medium model balances quality and CPU performance",
      alternatives,
      warnings,
    };
  }

  // Low RAM (4-8GB)
  if (availableRam >= 3000) {
    alternatives.push({ model: "base", reason: "Lighter weight option" });
    return {
      recommended: "small",
      reason: "Small model suitable for limited RAM",
      alternatives,
      warnings,
    };
  }

  // Very low RAM (<4GB)
  warnings.push("System has limited RAM - expect slower performance");
  return {
    recommended: "base",
    reason: "Base model for systems with limited resources",
    alternatives: [{ model: "tiny", reason: "Fastest option for very low resources" }],
    warnings,
  };
}

/**
 * Check if a specific model can run on the system
 */
export function canRunModel(modelId: string, metrics: SystemMetrics): { canRun: boolean; reason: string } {
  const spec = MODEL_SPECS[modelId];
  if (!spec) {
    return { canRun: false, reason: "Unknown model" };
  }

  const availableVram = metrics.vramMb || 0;
  const availableRam = metrics.availableRamMb || metrics.totalRamMb * 0.5;

  // GPU mode check
  if (metrics.hasGpu && metrics.cudaAvailable && availableVram >= spec.minVramMb) {
    return { canRun: true, reason: "GPU acceleration available" };
  }

  // CPU mode check
  if (availableRam >= spec.minRamMb) {
    return { canRun: true, reason: "CPU mode with sufficient RAM" };
  }

  // Cannot run
  const needed = metrics.hasGpu ? spec.minVramMb : spec.minRamMb;
  const available = metrics.hasGpu ? availableVram : availableRam;
  return {
    canRun: false,
    reason: `Insufficient memory: ${Math.round(available)}MB available, ${needed}MB required`,
  };
}

/**
 * Get quality tier description
 */
export function getQualityDescription(quality: ModelInfo["quality"]): string {
  switch (quality) {
    case "low":
      return "Basic accuracy, best for simple dictation";
    case "medium":
      return "Good accuracy, suitable for most use cases";
    case "high":
      return "Excellent accuracy, handles complex audio well";
    case "best":
      return "State-of-the-art accuracy, best for professional use";
  }
}

/**
 * Get speed tier description
 */
export function getSpeedDescription(speed: ModelInfo["speed"]): string {
  switch (speed) {
    case "fast":
      return "Near real-time transcription";
    case "medium":
      return "Moderate processing time";
    case "slow":
      return "Longer processing, highest quality";
  }
}
