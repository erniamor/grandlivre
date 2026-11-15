import { serve } from "@hono/node-server";
import { app } from "@/app";
import { client } from "@/db/client";
import { env } from "@/env";
import { startRecurringTimer } from "@/routes/recurring/recurring-runner";

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
	console.log(`API listening on http://localhost:${info.port}`);
});

// Records the recurring transactions whose day has come, the ones missed
// while the API was down first
const stopRecurring = startRecurringTimer(
	env.RECURRING_RUN_EVERY_SECONDS * 1000,
);

function shutdown() {
	stopRecurring();
	server.close(async () => {
		await client.end();
		process.exit(0);
	});
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
