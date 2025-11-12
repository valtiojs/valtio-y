import { defineConfig } from "tsdown";

export default [
  defineConfig({
    entry: "src/index.ts",
    format: ["esm"],
    sourcemap: true,
    dts: {
      sourcemap: true,
      build: true,
    },
    outDir: "dist",
    clean: true,
    tsconfig: "tsconfig.src.json",
    platform: "neutral",
    treeshake: true,
    minify: false,
  }),
];
