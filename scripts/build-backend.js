#!/usr/bin/env node
/**
 * Build backend into standalone executable using PyInstaller.
 * This creates a portable backend that doesn't require Python installation.
 *
 * Usage:
 *   node build-backend.js        # Build CUDA version (default — GPU mandatory)
 *   node build-backend.js --cpu  # Build CPU-only version (smaller, slow)
 */

const { execSync, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const backendDir = path.join(__dirname, "..", "backend");
const isWindows = process.platform === "win32";

// Parse arguments. CUDA is the default — the runtime is locked to GPU
// (config.py defaults VTT_DEVICE=cuda, no CPU fallback). The --cpu flag
// only exists for diagnostic builds; it produces a bundle that REQUIRES
// the user to also set VTT_DEVICE=cpu, otherwise model load will fail
// with a missing-CUDA error.
const args = process.argv.slice(2);
const buildCpu = args.includes("--cpu");
const specFile = buildCpu ? "server-cpu.spec" : "server.spec";
const buildType = buildCpu ? "CPU-only" : "CUDA";

// Find Python - prefer venv, fallback to system
function findPython() {
  const venvCandidates = isWindows
    ? [
        path.join(backendDir, ".venv", "Scripts", "python.exe"),
        path.join(backendDir, "venv", "Scripts", "python.exe"),
      ]
    : [
        path.join(backendDir, ".venv", "bin", "python"),
        path.join(backendDir, "venv", "bin", "python"),
        path.join(backendDir, ".venv", "bin", "python3"),
        path.join(backendDir, "venv", "bin", "python3"),
      ];

  for (const p of venvCandidates) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback to system Python (for CI environments)
  return isWindows ? "python" : "python3";
}

const pythonExe = findPython();
console.log("Using Python:", pythonExe);

// Check PyInstaller installed
try {
  execSync(`"${pythonExe}" -c "import PyInstaller"`, { stdio: "ignore" });
} catch {
  console.log("Installing PyInstaller...");
  execSync(`"${pythonExe}" -m pip install pyinstaller`, { stdio: "inherit" });
}

console.log(`Building backend with PyInstaller (${buildType})...`);
console.log("This may take a few minutes...\n");

// Clean previous build
const buildDir = path.join(backendDir, "build");
const distDir = path.join(backendDir, "dist");
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

const result = spawnSync(
  pythonExe,
  [
    "-m",
    "PyInstaller",
    "--clean",
    "--noconfirm",
    specFile,
  ],
  {
    cwd: backendDir,
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      // CPU build needs the env to short-circuit CUDA probing during the
      // PyInstaller analysis pass. CUDA build inherits the cuda default.
      ...(buildCpu ? { VTT_DEVICE: "cpu" } : {}),
    },
  }
);

if (result.status !== 0) {
  console.error("\nBackend build failed!");
  process.exit(result.status || 1);
}

// Verify output
const outputDir = path.join(backendDir, "dist", "vtt-backend");
const exeName = isWindows ? "vtt-backend.exe" : "vtt-backend";
const exePath = path.join(outputDir, exeName);

if (!fs.existsSync(exePath)) {
  console.error("Error: Built executable not found at:", exePath);
  process.exit(1);
}

// Calculate total size
let totalSize = 0;
function calcDirSize(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      calcDirSize(filePath);
    } else {
      totalSize += stat.size;
    }
  }
}
calcDirSize(outputDir);

const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
console.log(`\n✓ Backend built successfully! (${buildType})`);
console.log("  Output:", outputDir);
console.log("  Size:", sizeMB, "MB");

if (buildCpu && parseFloat(sizeMB) < 500) {
  console.log("\n  Note: CPU-only build is smaller but ~30x slower than CUDA.");
  console.log("  Drop --cpu to produce a CUDA bundle (default).");
}
