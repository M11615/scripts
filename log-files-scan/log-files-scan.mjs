#!/usr/bin/env node

import fs from "fs";
import { dirname, join, extname } from "path";
import { fileURLToPath } from "url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = dirname(currentFilePath);
const scanPathsFilePath = join(currentDirectoryPath, "./scan-paths.txt");
const logFileAbsolutePath = join(currentDirectoryPath, "./log-files-scan.log");
const CLEANUP_THRESHOLD_KB = 1024;

const appendLogMessage = (message) => {
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  fs.appendFileSync(logFileAbsolutePath, `[${timestamp}] ${message}\n`);
};

const isLogRelated = (name) => /log/i.test(name);
const isLogFile = (fileName) => [".log", ".txt"].includes(extname(fileName).toLowerCase());

const formatSizeKB = (sizeBytes) => (sizeBytes / 1024).toFixed(3);

const getDirectorySize = (dirPath) => {
  let totalSize = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        totalSize += fs.statSync(fullPath).size;
      }
    }
  } catch (error) {
    appendLogMessage(`Failed to access directory for size: ${dirPath} - ${error.message}`);
  }
  return totalSize;
};

const scanDirectory = (directoryPath, results) => {
  let entries;
  try {
    entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch (error) {
    appendLogMessage(`Failed to access directory: ${directoryPath} - ${error.message}`);
    return;
  }
  for (const entry of entries) {
    const fullPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (isLogRelated(entry.name)) {
        const sizeKB = formatSizeKB(getDirectorySize(fullPath));
        const cleanupFlag = parseFloat(sizeKB) >= CLEANUP_THRESHOLD_KB ? " [CLEANUP IF LOG]" : "";
        results.directories.push({ path: fullPath, sizeKB, cleanupFlag });
        appendLogMessage(`LOG-RELATED DIRECTORY: ${fullPath} (${sizeKB} KB)${cleanupFlag}`);
      }
      scanDirectory(fullPath, results);
    } else if (entry.isFile() && isLogRelated(entry.name) && isLogFile(entry.name)) {
      const sizeKB = formatSizeKB(fs.statSync(fullPath).size);
      const cleanupFlag = parseFloat(sizeKB) >= CLEANUP_THRESHOLD_KB ? " [CLEANUP IF LOG]" : "";
      results.files.push({ path: fullPath, sizeKB, cleanupFlag });
      appendLogMessage(`LOG-RELATED FILE: ${fullPath} (${sizeKB} KB)${cleanupFlag}`);
    }
  }
};

const main = () => {
  appendLogMessage("=====================================================================");
  appendLogMessage(`Log-Related Files Scan Started at ${new Date().toLocaleString()}`);
  appendLogMessage(`Scan paths file: ${scanPathsFilePath}`);
  appendLogMessage("=====================================================================");
  if (!fs.existsSync(scanPathsFilePath)) {
    appendLogMessage(`ERROR: Scan paths file not found: ${scanPathsFilePath}`);
    console.error(`Scan paths file not found: ${scanPathsFilePath}`);
    process.exit(1);
  }
  const scanPaths = fs
    .readFileSync(scanPathsFilePath, "utf-8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
  if (scanPaths.length === 0) {
    appendLogMessage("ERROR: No valid scan paths found.");
    console.error("No valid scan paths found.");
    process.exit(1);
  }
  const results = { directories: [], files: [] };
  for (const scanPath of scanPaths) {
    appendLogMessage("");
    appendLogMessage("-------------------------------------------------------------");
    appendLogMessage(`Scanning directory: ${scanPath}`);
    appendLogMessage("-------------------------------------------------------------");
    if (!fs.existsSync(scanPath)) {
      appendLogMessage(`WARNING: Directory does not exist: ${scanPath}`);
      continue;
    }
    scanDirectory(scanPath, results);
  }
  appendLogMessage("");
  appendLogMessage("=====================================================================");
  appendLogMessage(`Scan Completed at ${new Date().toLocaleString()}`);
  appendLogMessage(`Log-Related Directories Found: ${results.directories.length}`);
  appendLogMessage(`Log-Related Files Found: ${results.files.length}`);
  appendLogMessage("=====================================================================");
  console.log(`Log saved to: ${logFileAbsolutePath}`);
};

main();
