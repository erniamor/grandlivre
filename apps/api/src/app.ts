import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { handleError, handleNotFound } from "@/lib/error-handler";
import { errorBody } from "@/lib/errors";
import { healthRoutes } from "@/routes/health/health.routes";
import { householdRoutes } from "@/routes/households/households.routes";
import { invitationRoutes } from "@/routes/invitations/invitations.routes";
import { meRoutes } from "@/routes/me/me.routes";

const MAX_BODY_SIZE = 1024 * 1024;

// Routes taking a file, with their own limit: a receipt's photo, a recording,
// a statement
const FILE_ROUTES =
	/^\/v1\/households\/[^/]+\/(transactions\/draft\/(receipt|transcribe)|imports(\/preview)?)$/;

const defaultBodyLimit = bodyLimit({
	maxSize: MAX_BODY_SIZE,
	onError: (c) =>
		c.json(errorBody("payload_too_large", "Request body is too large"), 413),
});

const v1 = new Hono()
	// Better Auth endpoints: sign-in, sign-out, session...
	.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
	.route("/health", healthRoutes)
	.route("/households", householdRoutes)
	.route("/invitations", invitationRoutes)
	.route("/me", meRoutes);

export const app = new Hono();

if (env.NODE_ENV === "development") {
	app.use(logger());
}

app
	.use(secureHeaders())
	.use(cors({ origin: env.CORS_ORIGINS, credentials: true }))
	.use(csrf({ origin: env.CORS_ORIGINS }))
	.use((c, next) =>
		// A file has its own limit, on its route
		FILE_ROUTES.test(c.req.path) ? next() : defaultBodyLimit(c, next),
	)
	.route("/v1", v1);

app.onError(handleError);
app.notFound(handleNotFound);
