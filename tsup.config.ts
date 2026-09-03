import { readFileSync } from "fs";
import { defineConfig } from "tsup";

// The version is baked in at build time so the binary can identify itself
// (X-LumifyHub-Client: lh/<version>) without reading package.json from disk at
// runtime — the installed CLI may not sit next to its package.json.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  define: {
    __LH_VERSION__: JSON.stringify(pkg.version),
  },
});
