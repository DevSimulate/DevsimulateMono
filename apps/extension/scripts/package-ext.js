#!/usr/bin/env node
/**
 * Packages the extension in a temp directory so vsce doesn't crawl
 * up into the monorepo root and bundle unrelated files.
 */
const fs   = require("fs");
const path = require("path");
const os   = require("os");
const { execSync } = require("child_process");

const extDir  = path.resolve(__dirname, "..");
const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), "devsimulate-ext-"));

console.log(`Staging extension in: ${tmpDir}`);

const copy = (src, dest) => {
  const target = path.join(tmpDir, dest);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
};

const copyDir = (src, destRel) => {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const srcPath  = path.join(src, e.name);
    const destPath = path.join(destRel, e.name);
    if (e.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copy(srcPath, destPath);
    }
  }
};

// Copy only the files vsce needs
copy(path.join(extDir, "package.json"),  "package.json");
copy(path.join(extDir, "README.md"),     "README.md");
copy(path.join(extDir, "LICENSE"),       "LICENSE");
copy(path.join(extDir, "out", "extension.js"), "out/extension.js");
copyDir(path.join(extDir, "media"), "media");

// Minimal .vscodeignore — everything is already filtered by the copy above
fs.writeFileSync(path.join(tmpDir, ".vscodeignore"), "node_modules/**\nsrc/**\n");

// Run vsce package from the isolated temp dir
execSync("npx @vscode/vsce package --no-dependencies", {
  cwd:   tmpDir,
  stdio: "inherit",
});

// Copy the .vsix back to the extension directory
const pkg     = JSON.parse(fs.readFileSync(path.join(extDir, "package.json"), "utf8"));
const vsixName = `${pkg.name}-${pkg.version}.vsix`;
fs.copyFileSync(path.join(tmpDir, vsixName), path.join(extDir, vsixName));

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\nPackaged: ${vsixName}`);
