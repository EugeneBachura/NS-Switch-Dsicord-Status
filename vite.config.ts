/// <reference types="vitest" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  publicDir: "../../public",
  base: "./",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared")
    }
  },
  test: {
    environment: "node",
    include: ["../../tests/**/*.test.ts"]
  }
});
