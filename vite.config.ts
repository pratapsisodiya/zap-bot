import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  build: {
    minify: "esbuild",
  },
  optimizeDeps: {
    exclude: ["@clerk/nextjs"],
  },
  plugins: [
    vinext(),
    ...(command === "build"
      ? [
          cloudflare({
            viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
          }),
        ]
      : []),
  ],
}));
