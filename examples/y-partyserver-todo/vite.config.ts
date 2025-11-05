import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // Enable local persistence for Durable Objects
      persistState: {
        path: ".wrangler/state/v3",
      },
      // Point to wrangler config
      configPath: "./wrangler.jsonc",
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
});
