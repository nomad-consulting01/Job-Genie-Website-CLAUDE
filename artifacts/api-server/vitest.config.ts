import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    include: ["src/**/__tests__/**/*.test.ts"],
    alias: {
      "@workspace/db": path.resolve(__dirname, "src/__mocks__/@workspace/db.ts"),
      "@workspace/site-config": path.resolve(__dirname, "src/__mocks__/@workspace/site-config.ts"),
      "@workspace/api-zod": path.resolve(__dirname, "src/__mocks__/@workspace/api-zod.ts"),
      "@workspace/integrations-anthropic-ai": path.resolve(__dirname, "src/__mocks__/@workspace/integrations-anthropic-ai.ts"),
      "@workspace/integrations-gemini-ai": path.resolve(__dirname, "src/__mocks__/@workspace/integrations-gemini-ai.ts"),
    },
  },
});
