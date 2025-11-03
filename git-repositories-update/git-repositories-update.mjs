#!/usr/bin/env node

import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repositoryListFile = join(__dirname, "repositories.txt");
const logFilePath = join(__dirname, "git-repositories-update.log");

function log(message) {
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!fs.existsSync(repositoryListFile)) {
    console.error(`Repository list file not found: ${repositoryListFile}`);
    console.error("Please create it with one repository path per line.");
    process.exit(1);
  }
  const repositoryPathList = fs
    .readFileSync(repositoryListFile, "utf-8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  if (repositoryPathList.length === 0) {
    console.error(`No valid repository paths found in ${repositoryListFile}`);
    process.exit(1);
  }
  const totalRepositories = repositoryPathList.length;
  let successfulUpdates = 0;
  const retryCountMap = new Map();
  log("=====================================================================");
  log(`Batch Git Pull Process Started at ${new Date().toLocaleString()}`);
  log(`Repositories file: ${repositoryListFile}`);
  log("=====================================================================");
  for (const repoPath of repositoryPathList) {
    log("");
    log("-------------------------------------------------------------");
    log(`Processing repository: ${repoPath}`);
    log("-------------------------------------------------------------");
    if (fs.existsSync(join(repoPath, ".git"))) {
      let updateSuccess = false;
      let retryCount = 0;
      while (!updateSuccess) {
        try {
          log("Executing: git pull");
          const { stdout, stderr } = await execAsync("git pull", { cwd: repoPath });
          if (stderr && !stdout.trim()) {
            throw new Error(stderr);
          }
          log(stdout.trim());
          log(`Completed update for: ${repoPath}`);
          successfulUpdates++;
          updateSuccess = true;
          const now = new Date();
          if (fs.existsSync(repoPath)) {
            fs.utimesSync(repoPath, now, now);
            log(`Updated repository directory timestamp: ${repoPath}`);
          }
          const parentDir = dirname(repoPath);
          if (fs.existsSync(parentDir)) {
            fs.utimesSync(parentDir, now, now);
            log(`Updated parent directory timestamp: ${parentDir}`);
          }
        } catch (err) {
          retryCount++;
          retryCountMap.set(repoPath, retryCount);
          log(`git pull failed for ${repoPath}: ${err.message}`);
          log("Retrying in 5 seconds...");
          await sleep(5000);
        }
      }
    } else {
      log(`Warning: ${repoPath} is not a valid Git repository.`);
    }
  }
  log("");
  log("=====================================================================");
  log(`Batch Git Pull Process Completed at ${new Date().toLocaleString()}`);
  log("=====================================================================");
  log(`Total Repositories: ${totalRepositories}`);
  log(`Successfully Updated: ${successfulUpdates}`);
  if (retryCountMap.size > 0) {
    log("Repositories with Retries:");
    for (const [repo, count] of retryCountMap.entries()) {
      log(`${repo} - Retries: ${count}`);
    }
  }
  log("=====================================================================");
  console.log(`All repositories processed. Log saved to: ${logFilePath}`);
}

await main();
