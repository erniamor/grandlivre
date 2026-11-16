import { STATEMENT_MAX_BYTES } from "@repo/schemas";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { errorBody } from "@/lib/errors";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { statementFormSchema } from "@/routes/imports/imports.schemas";
import { previewStatement } from "@/routes/imports/imports.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * Bank statements imported into a household's accounts. Mounted under
 * `/households/:householdId/imports`, behind `requireHouseholdMember`.
 */
export const importRoutes = new Hono<Env>()
	// A statement read and compared with the household: nothing is saved,
	// the file least of all
	.post(
		"/preview",
		bodyLimit({
			maxSize: STATEMENT_MAX_BYTES + 64 * 1024,
			onError: (c) =>
				c.json(errorBody("payload_too_large", "The file is too large"), 413),
		}),
		validate("form", statementFormSchema),
		async (c) => {
			const { file, targets } = c.req.valid("form");
			return c.json(
				await previewStatement(
					viewerOf(c),
					new Uint8Array(await file.arrayBuffer()),
					targets,
				),
			);
		},
	);
