#!/usr/bin/env node
/**
 * Cross-platform backend starter script
 * Detects OS and runs the appropriate Python command from the virtual environment
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const backendDir = path.join(__dirname, "..", "backend");
const isWindows = process.platform === "win32";

// Python executable paths to try in order
const pythonPaths = isWindows
  ? [
      path.join(backendDir, ".venv", "Scripts", "python.exe"),
      path.join(backendDir, "venv", "Scripts", "python.exe"),
      "python",
    ]
  : [
      path.join(backendDir, ".venv", "bin", "python"),
      path.join(backendDir, "venv", "bin", "python"),
      "python3",
      "python",
    ];

function findPython() {
  for (const pythonPath of pythonPaths) {
    if (path.isAbsolute(pythonPath)) {
      if (fs.existsSync(pythonPath)) {
        return pythonPath;
      }
    } else {
      // System python - assume it exists
      return pythonPath;
    }
  }
  return null;
}

const pythonExe = findPython();

if (!pythonExe) {
  console.error("Error: Python not found. Please create a virtual environment:");
  console.error(`  cd backend && python -m venv .venv`);
  console.error(`  ${isWindows ? ".venv\\Scripts\\pip" : ".venv/bin/pip"} install -r requirements.txt`);
  process.exit(1);
}

console.log(`Starting backend with: ${pythonExe}`);

const serverScript = path.join(backendDir, "server.py");

const proc = spawn(pythonExe, [serverScript], {
  cwd: backendDir,
  stdio: "inherit",
  env: { ...process.env, PYTHONUNBUFFERED: "1" },
});

proc.on("error", (err) => {
  console.error(`Failed to start backend: ${err.message}`);
  process.exit(1);
});

proc.on("exit", (code) => {
  process.exit(code || 0);
});

// Forward termination signals
process.on("SIGINT", () => proc.kill("SIGINT"));
process.on("SIGTERM", () => proc.kill("SIGTERM"));
