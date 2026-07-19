import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["node_modules", "dist", "dashboard/**"],
    globalSetup: "./tests/globalSetup.ts",
    env: {
      NODE_ENV: "test",
    },
    // CI環境での統合テストの安定性向上
    retry: process.env.CI ? 2 : 0,
    testTimeout: process.env.CI ? 30000 : 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/fixtures/**",
        "src/**/generated/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
