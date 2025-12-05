#!/usr/bin/env node

import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { exec } from "child_process";

const executeCommandAsync = promisify(exec);
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = dirname(currentFilePath);
const repositoryListFilePath = join(currentDirectoryPath, "./repositories.txt");
const logFileAbsolutePath = join(currentDirectoryPath, "./git-repositories-update.log");

function appendLogMessage(message) {
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  fs.appendFileSync(logFileAbsolutePath, `[${timestamp}] ${message}\n`);
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function main() {
  if (!fs.existsSync(repositoryListFilePath)) {
    console.error(`Repository list file not found: ${repositoryListFilePath}`);
    console.error("Please create it with one repository path per line.");
    process.exit(1);
  }
  const repositoryPaths = fs
    .readFileSync(repositoryListFilePath, "utf-8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  if (repositoryPaths.length === 0) {
    console.error(`No valid repository paths found in ${repositoryListFilePath}`);
    process.exit(1);
  }
  const totalRepositoryCount = repositoryPaths.length;
  let successfulRepositoryCount = 0;
  const retryCountsByRepository = new Map();
  appendLogMessage("=====================================================================");
  appendLogMessage(`Batch Git Pull Process Started at ${new Date().toLocaleString()}`);
  appendLogMessage(`Repositories file: ${repositoryListFilePath}`);
  appendLogMessage("=====================================================================");
  for (const repositoryPath of repositoryPaths) {
    appendLogMessage("");
    appendLogMessage("-------------------------------------------------------------");
    appendLogMessage(`Processing repository: ${repositoryPath}`);
    appendLogMessage("-------------------------------------------------------------");
    if (fs.existsSync(join(repositoryPath, ".git"))) {
      let isUpdateSuccessful = false;
      let retryCount = 0;
      while (!isUpdateSuccessful) {
        try {
          const { stdout: remoteUrl } = await executeCommandAsync(
            "git remote get-url origin",
            { cwd: repositoryPath }
          );
          appendLogMessage("Executing: git pull");
          const { stdout, stderr } = await executeCommandAsync("git pull", { cwd: repositoryPath });
          if (stderr && !stdout.trim()) {
            throw new Error(stderr);
          }
          appendLogMessage(stdout.trim());
          appendLogMessage(`Update completed - Remote: ${remoteUrl.trim()}, Local: ${repositoryPath}`);
          successfulRepositoryCount++;
          isUpdateSuccessful = true;
        } catch (error) {
          retryCount++;
          retryCountsByRepository.set(repositoryPath, retryCount);
          appendLogMessage(`git pull failed for ${repositoryPath}: ${error.message}`);
          appendLogMessage("Retrying in 5 seconds...");
          await delay(5000);
        }
      }
    } else {
      appendLogMessage(`Warning: ${repositoryPath} is not a valid Git repository.`);
    }
  }
  appendLogMessage("");
  appendLogMessage("=====================================================================");
  appendLogMessage(`Batch Git Pull Process Completed at ${new Date().toLocaleString()}`);
  appendLogMessage("=====================================================================");
  appendLogMessage(`Total Repositories: ${totalRepositoryCount}`);
  appendLogMessage(`Successfully Updated: ${successfulRepositoryCount}`);
  if (retryCountsByRepository.size > 0) {
    appendLogMessage("Repositories with Retries:");
    for (const [repositoryPath, retryCount] of retryCountsByRepository.entries()) {
      appendLogMessage(`${repositoryPath} - Retries: ${retryCount}`);
    }
  }
  appendLogMessage("=====================================================================");
  console.log(`All repositories processed. Log saved to: ${logFileAbsolutePath}`);
}

await main();
