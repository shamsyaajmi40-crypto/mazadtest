import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const JS_EXT = ".js";
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist"]);

const getFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files = files.concat(getFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith(JS_EXT)) {
      files.push(fullPath);
    }
  }

  return files;
};

const files = getFiles("backend");
let hasSyntaxErrors = false;
let hasCheckFailures = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    hasCheckFailures = true;
    console.log(`CHECK FAILED in ${file}:`);
    console.log(String(result.error));
    continue;
  }

  if (result.status === 0) continue;

  hasSyntaxErrors = true;
  const details =
    (result.stderr && result.stderr.trim()) ||
    (result.stdout && result.stdout.trim()) ||
    "Unknown syntax check error";

  console.log(`SYNTAX ERROR in ${file}:`);
  console.log(details);
}

if (hasSyntaxErrors || hasCheckFailures) {
  process.exitCode = 1;
  if (hasCheckFailures) {
    console.log("Syntax check finished with execution failures.");
  }
  if (hasSyntaxErrors) {
    console.log("Syntax check finished with syntax errors.");
  }
} else {
  console.log("Syntax check passed.");
}
