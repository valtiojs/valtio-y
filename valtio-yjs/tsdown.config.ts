import { defineConfig } from "tsdown"

export default [
  defineConfig({
    entry: "src/index.ts",
    format: ["esm", "cjs"],
    sourcemap: true,
    dts: {
      sourcemap: true,
      build: true,
    },
    outDir: "dist",
    clean: true,
    tsconfig: false,
    platform: "neutral",
    treeshake: true,
    minify: false,
  }),
]
