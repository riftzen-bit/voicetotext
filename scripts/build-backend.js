#!/usr/bin/env node
/**
 * Build backend into standalone executable using PyInstaller.
 * This creates a portable backend that doesn't require Python installation.
 *
 * Usage:
 *   node build-backend.js         # Build CPU-only version (default, smaller)
 *   node build-backend.js --cuda  # Build CUDA version (larger, faster inference)
 */

const { execSync, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const backendDir = path.join(__dirname, "..", "backend");
const isWindows = process.platform === "win32";

// Parse arguments
const args = process.argv.slice(2);
const buildCuda = args.includes("--cuda");
const specFile = buildCuda ? "server.spec" : "server-cpu.spec";
const buildType = buildCuda ? "CUDA" : "CPU-only";

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
      // Force CPU device for CPU-only build
      ...(buildCuda ? {} : { VTT_DEVICE: "cpu" }),
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

if (!buildCuda && parseFloat(sizeMB) < 500) {
  console.log("\n  Note: CPU-only build is smaller but uses CPU for inference.");
  console.log("  Use --cuda flag to build with CUDA support for faster GPU inference.");
}
