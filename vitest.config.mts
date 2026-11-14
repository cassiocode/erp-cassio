import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Testes usam banco em memória: nunca tocam em data/estoque.db
    env: { DB_PATH: ":memory:" },
  },
});
