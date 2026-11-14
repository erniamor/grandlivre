import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@test": fileURLToPath(new URL("./test", import.meta.url)),
		},
	},
	test: {
		env: {
			NODE_ENV: "test",
			PORT: "3001",
			API_URL: "http://localhost:3001",
			APP_URL: "http://localhost:3000",
			// Test database created by docker/postgres/init.sql
			// (TEST_DATABASE_URL points the tests to another database, e.g. in CI)
			DATABASE_URL:
				process.env.TEST_DATABASE_URL ??
				"postgres://grandlivre:grandlivre@localhost:5434/grandlivre_test",
			BETTER_AUTH_SECRET: "test-secret-not-used-outside-of-the-tests",
			CORS_ORIGINS: "http://localhost:3000",
		},
		globalSetup: ["./test/global-setup.ts"],
		setupFiles: ["./test/reset-database.ts"],
		// Test files share one database
		fileParallelism: false,
	},
});
