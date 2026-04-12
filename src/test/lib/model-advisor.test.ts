import { describe, it, expect } from 'vitest';
import {
  recommendModel,
  canRunModel,
  getDefaultMetrics,
  MODEL_SPECS,
  SystemMetrics,
} from '../../lib/model-advisor';

describe('model-advisor', () => {
  describe('recommendModel', () => {
    it('recommends large-v3 for high-end GPU (8GB+ VRAM)', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: true,
        vramMb: 10000,
        cpuCores: 8,
        totalRamMb: 16000,
        availableRamMb: 12000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.recommended).toBe('large-v3');
      expect(result.warnings).toHaveLength(0);
    });

    it('recommends large-v3-turbo for mid-range GPU (6-8GB VRAM)', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: true,
        vramMb: 6500,
        cpuCores: 8,
        totalRamMb: 16000,
        availableRamMb: 12000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.recommended).toBe('large-v3-turbo');
    });

    it('recommends medium for lower-mid GPU (4-6GB VRAM)', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: true,
        vramMb: 4500,
        cpuCores: 6,
        totalRamMb: 16000,
        availableRamMb: 12000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.recommended).toBe('medium');
    });

    it('recommends small for low-end GPU (2-4GB VRAM)', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: true,
        vramMb: 3000,
        cpuCores: 4,
        totalRamMb: 8000,
        availableRamMb: 6000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.recommended).toBe('small');
    });

    it('falls back to CPU mode when no CUDA available', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: false,
        vramMb: 8000,
        cpuCores: 8,
        totalRamMb: 16000,
        availableRamMb: 10000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.warnings).toContain('No CUDA GPU detected - using CPU mode (slower)');
    });

    it('recommends large-v3-turbo for high RAM CPU-only system', () => {
      const metrics: SystemMetrics = {
        hasGpu: false,
        cpuCores: 8,
        totalRamMb: 32000,
        availableRamMb: 16000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.recommended).toBe('large-v3-turbo');
    });

    it('recommends medium for medium RAM CPU-only system', () => {
      const metrics: SystemMetrics = {
        hasGpu: false,
        cpuCores: 4,
        totalRamMb: 12000,
        availableRamMb: 8000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.recommended).toBe('medium');
    });

    it('recommends base for very low RAM system', () => {
      const metrics: SystemMetrics = {
        hasGpu: false,
        cpuCores: 2,
        totalRamMb: 4000,
        availableRamMb: 2000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.recommended).toBe('base');
      expect(result.warnings).toContain('System has limited RAM - expect slower performance');
    });

    it('provides alternatives in recommendations', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: true,
        vramMb: 8000,
        cpuCores: 8,
        totalRamMb: 16000,
        availableRamMb: 12000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = recommendModel(metrics);
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('canRunModel', () => {
    it('returns true for model within VRAM limits', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: true,
        vramMb: 8000,
        cpuCores: 8,
        totalRamMb: 16000,
        availableRamMb: 12000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = canRunModel('large-v3', metrics);
      expect(result.canRun).toBe(true);
    });

    it('returns false for model exceeding VRAM limits', () => {
      const metrics: SystemMetrics = {
        hasGpu: true,
        cudaAvailable: true,
        vramMb: 2000,
        cpuCores: 4,
        totalRamMb: 4000,
        availableRamMb: 2000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = canRunModel('large-v3', metrics);
      expect(result.canRun).toBe(false);
      expect(result.reason).toContain('Insufficient memory');
    });

    it('returns false for unknown model', () => {
      const metrics = getDefaultMetrics();
      const result = canRunModel('nonexistent-model', metrics);
      expect(result.canRun).toBe(false);
      expect(result.reason).toBe('Unknown model');
    });

    it('allows CPU fallback when GPU unavailable but RAM sufficient', () => {
      const metrics: SystemMetrics = {
        hasGpu: false,
        cpuCores: 8,
        totalRamMb: 32000,
        availableRamMb: 20000,
        platform: 'win32',
        arch: 'x64',
      };

      const result = canRunModel('large-v3', metrics);
      expect(result.canRun).toBe(true);
      expect(result.reason).toBe('CPU mode with sufficient RAM');
    });
  });

  describe('getDefaultMetrics', () => {
    it('returns valid default metrics', () => {
      const metrics = getDefaultMetrics();
      expect(metrics.hasGpu).toBe(false);
      expect(metrics.cpuCores).toBeGreaterThan(0);
      expect(metrics.totalRamMb).toBeGreaterThan(0);
    });
  });

  describe('MODEL_SPECS', () => {
    it('contains all expected models', () => {
      const expectedModels = ['tiny', 'base', 'small', 'medium', 'large-v3', 'large-v3-turbo', 'distil-large-v3'];
      for (const model of expectedModels) {
        expect(MODEL_SPECS[model]).toBeDefined();
        expect(MODEL_SPECS[model].sizeMb).toBeGreaterThan(0);
        expect(MODEL_SPECS[model].minVramMb).toBeGreaterThan(0);
      }
    });

    it('has increasing size for larger models', () => {
      expect(MODEL_SPECS['tiny'].sizeMb).toBeLessThan(MODEL_SPECS['base'].sizeMb);
      expect(MODEL_SPECS['base'].sizeMb).toBeLessThan(MODEL_SPECS['small'].sizeMb);
      expect(MODEL_SPECS['small'].sizeMb).toBeLessThan(MODEL_SPECS['medium'].sizeMb);
      expect(MODEL_SPECS['medium'].sizeMb).toBeLessThan(MODEL_SPECS['large-v3'].sizeMb);
    });
  });
});
