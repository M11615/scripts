#!/usr/bin/env node

import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { exec } from "child_process";

const executeCommandAsync = promisify(exec);
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = dirname(currentFilePath);
const logFileAbsolutePath = join(currentDirectoryPath, "nodejs-package-managers-update.log");

function appendLogMessage(message) {
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  fs.appendFileSync(logFileAbsolutePath, `[${timestamp}] ${message}\n`);
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function getVersion(command) {
  try {
    const { stdout } = await executeCommandAsync(command);

    return stdout.trim();
  } catch {
    return "Unknown";
  }
}

async function updateWithRetry(label, getVersionCmd, updateCmd, maxRetries = 3) {
  appendLogMessage("-------------------------------------------------------------");
  appendLogMessage(`Processing: ${label}`);
  appendLogMessage("-------------------------------------------------------------");
  const beforeVersion = await getVersion(getVersionCmd);
  appendLogMessage(`Before version: ${beforeVersion}`);
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      appendLogMessage(`Executing: ${updateCmd}`);
      const { stdout, stderr } = await executeCommandAsync(updateCmd);
      if (stderr && !stdout.trim()) throw new Error(stderr);
      appendLogMessage(stdout.trim());
      const afterVersion = await getVersion(getVersionCmd);
      appendLogMessage(`Update successful. After version: ${afterVersion}`);
      return { success: true, beforeVersion, afterVersion };
    } catch (err) {
      attempts++;
      appendLogMessage(`${label} update failed: ${err.message}`);
      if (attempts < maxRetries) {
        appendLogMessage(`Retrying in 5 seconds... (Attempt ${attempts}/${maxRetries})`);
        await delay(5000);
      }
    }
  }
  appendLogMessage(`${label} update failed after ${maxRetries} attempts.`);

  return { success: false, beforeVersion: beforeVersion, afterVersion: beforeVersion };
}

async function main() {
  appendLogMessage("=====================================================================");
  appendLogMessage(`Package Managers Update Started at ${new Date().toLocaleString()}`);
  appendLogMessage("=====================================================================");
  const results = {};
  results.npm = await updateWithRetry(
    "npm",
    "npm -v",
    "npm install -g npm"
  );
  results.yarn = await updateWithRetry(
    "Yarn (Corepack)",
    "yarn -v",
    "corepack prepare yarn@stable --activate"
  );
  results.pnpm = await updateWithRetry(
    "pnpm (Corepack)",
    "pnpm -v",
    "corepack prepare pnpm@latest --activate"
  );
  appendLogMessage("");
  appendLogMessage("=====================================================================");
  appendLogMessage(`Package Managers Update Completed at ${new Date().toLocaleString()}`);
  appendLogMessage("=====================================================================");
  for (const key of Object.keys(results)) {
    const r = results[key];
    appendLogMessage(
      `${key.toUpperCase()}: ${r.success ? "Updated" : "Failed"} | Before: ${r.beforeVersion} | After: ${r.afterVersion}`
    );
  }
  appendLogMessage("=====================================================================");
  console.log(`All updates processed. Log saved to: ${logFileAbsolutePath}`);
}

await main();
