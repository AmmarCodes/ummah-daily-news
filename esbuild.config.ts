import { buildSync } from "esbuild";
import fs from "fs";

console.log("Building Cloudflare Worker...");

const outDir = "dist";
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

buildSync({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "browser",
  target: "esnext",
  format: "esm",
  outfile: `${outDir}/worker.js`,
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production",
  treeShaking: true,
  logLevel: "info",
  define: {
    "process.env.IS_LAMBDA": "false",
  },
});

console.log(`✓ Cloudflare Worker built successfully`);
console.log(`✓ Output: ${outDir}/worker.js`);
