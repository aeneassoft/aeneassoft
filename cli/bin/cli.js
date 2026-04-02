#!/usr/bin/env node

/**
 * AeneasSoft CLI — The Open Source Kill Switch for AI Agents
 *
 * Usage:
 *   npx aeneassoft start     Start local dashboard (ClickHouse + Backend)
 *   npx aeneassoft stop      Stop local services
 *   npx aeneassoft status    Check service health
 *   npx aeneassoft help      Show this help
 */

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const LOGO = `
  ╔═══════════════════════════════════════════════╗
  ║  AeneasSoft — Kill Switch for AI Agents       ║
  ║  Open Source · Patent Pending · MIT License    ║
  ╚═══════════════════════════════════════════════╝
`;

const HELP = `
Usage: aeneassoft <command>

Commands:
  start     Start local dashboard (ClickHouse + Backend API)
  stop      Stop all local services
  status    Check if services are running
  help      Show this help message

Quickstart:
  1. npx aeneassoft start
  2. pip install aeneas-agentwatch
  3. python -c "import agentwatch; agentwatch.init(); agentwatch.verify()"
  4. Open http://localhost:3001/health

Docs: https://aeneassoft.com/en/docs
GitHub: https://github.com/aeneassoft/aeneassoft
Discord: https://discord.gg/3QjFDQmCJ
`;

function checkDocker() {
  try {
    execSync("docker --version", { stdio: "pipe" });
    return true;
  } catch {
    console.error("\n❌ Docker is not installed or not running.");
    console.error("   Install Docker: https://docs.docker.com/get-docker/\n");
    return false;
  }
}

function checkDockerCompose() {
  try {
    execSync("docker compose version", { stdio: "pipe" });
    return true;
  } catch {
    try {
      execSync("docker-compose version", { stdio: "pipe" });
      return true;
    } catch {
      console.error("\n❌ Docker Compose is not available.");
      return false;
    }
  }
}

function getComposeFile() {
  // Check if we're in the aeneassoft repo
  const localCompose = path.resolve("docker-compose.local.yml");
  if (fs.existsSync(localCompose)) return localCompose;

  // Check parent directories
  const parentCompose = path.resolve("..", "docker-compose.local.yml");
  if (fs.existsSync(parentCompose)) return parentCompose;

  return null;
}

function writeInlineCompose() {
  // Generate a minimal docker-compose file for users who run npx aeneassoft start
  // outside of the repo
  const tmpDir = path.join(require("os").tmpdir(), "aeneassoft");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const composeContent = `
services:
  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    ports: ["8123:8123"]
    environment:
      CLICKHOUSE_DB: "productname"
    volumes:
      - aeneassoft_data:/var/lib/clickhouse
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "localhost:8123/ping"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  aeneassoft_data:
`;

  const composePath = path.join(tmpDir, "docker-compose.yml");
  fs.writeFileSync(composePath, composeContent);
  return composePath;
}

function start() {
  console.log(LOGO);

  if (!checkDocker()) return;
  if (!checkDockerCompose()) return;

  let composeFile = getComposeFile();

  if (composeFile) {
    console.log("📁 Found docker-compose.local.yml — starting full local stack...\n");
  } else {
    console.log("📦 No local compose file found — starting minimal ClickHouse...\n");
    composeFile = writeInlineCompose();
  }

  console.log("🚀 Starting services...\n");

  try {
    execSync(`docker compose -f "${composeFile}" up -d`, {
      stdio: "inherit",
    });
  } catch {
    try {
      execSync(`docker-compose -f "${composeFile}" up -d`, {
        stdio: "inherit",
      });
    } catch (err) {
      console.error("\n❌ Failed to start services. Is Docker running?");
      process.exit(1);
    }
  }

  console.log("\n✅ AeneasSoft is running!\n");
  console.log("   Backend API:  http://localhost:3001/health");
  console.log("   ClickHouse:   http://localhost:8123\n");
  console.log("   Next steps:");
  console.log("   1. pip install aeneas-agentwatch");
  console.log('   2. python -c "import agentwatch; agentwatch.init(); agentwatch.verify()"');
  console.log("   3. Make any LLM call — it's automatically traced\n");
  console.log("   Docs:    https://aeneassoft.com/en/docs");
  console.log("   Discord: https://discord.gg/3QjFDQmCJ\n");
}

function stop() {
  console.log(LOGO);

  const composeFile = getComposeFile();
  if (composeFile) {
    execSync(`docker compose -f "${composeFile}" down`, { stdio: "inherit" });
  } else {
    const tmpCompose = path.join(require("os").tmpdir(), "aeneassoft", "docker-compose.yml");
    if (fs.existsSync(tmpCompose)) {
      execSync(`docker compose -f "${tmpCompose}" down`, { stdio: "inherit" });
    }
  }
  console.log("\n✅ AeneasSoft stopped.\n");
}

function status() {
  console.log(LOGO);

  try {
    const result = execSync("docker ps --format '{{.Names}} {{.Status}}'", {
      encoding: "utf-8",
    });
    const lines = result.split("\n").filter((l) => l.includes("aeneassoft") || l.includes("clickhouse"));
    if (lines.length > 0) {
      console.log("Running services:\n");
      lines.forEach((l) => console.log(`  ● ${l}`));
    } else {
      console.log("  No AeneasSoft services running.");
      console.log("  Run: npx aeneassoft start");
    }
  } catch {
    console.log("  Could not check Docker status.");
  }
  console.log();
}

// Main
const command = process.argv[2] || "help";

switch (command) {
  case "start":
    start();
    break;
  case "stop":
    stop();
    break;
  case "status":
    status();
    break;
  case "help":
  case "--help":
  case "-h":
    console.log(LOGO);
    console.log(HELP);
    break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log(HELP);
    process.exit(1);
}
