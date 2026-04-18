#!/usr/bin/env node
/**
 * Cross-platform backend starter script
 * Detects OS and runs the appropriate Python command from the virtual environment
 */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const backendDir = path.join(__dirname, "..", "backend");
const isWindows = process.platform === "win32";
const BACKEND_PORT = Number(process.env.VTT_PORT || 8769);

function probeHealth(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/health", timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function adoptExisting() {
  console.log(
    `[start-backend] Found existing backend on 127.0.0.1:${BACKEND_PORT} - adopting it. ` +
      `This process will idle until SIGINT/SIGTERM.`
  );
  const keepalive = setInterval(() => {}, 60_000);
  const shutdown = () => {
    clearInterval(keepalive);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

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

async function main() {
  if (await probeHealth(BACKEND_PORT)) {
    adoptExisting();
    return;
  }

  const pythonExe = findPython();

  if (!pythonExe) {
    console.error("Error: Python not found. Please create a virtual environment:");
    console.error(`  cd backend && python -m venv .venv`);
    console.error(
      `  ${isWindows ? ".venv\\Scripts\\pip" : ".venv/bin/pip"} install -r requirements.txt`
    );
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

  process.on("SIGINT", () => proc.kill("SIGINT"));
  process.on("SIGTERM", () => proc.kill("SIGTERM"));
}

main();
