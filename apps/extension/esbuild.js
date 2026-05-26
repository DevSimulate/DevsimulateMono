const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

esbuild
  .build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    target: "node20",
    sourcemap: true,
    minify: false,
  })
  .catch(() => process.exit(1));
