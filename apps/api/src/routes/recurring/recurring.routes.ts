import {
	createRecurringTransactionSchema,
	recurringSuggestionKeySchema,
	updateRecurringTransactionSchema,
	updateTransactionSchema,
} from "@repo/schemas";
import { type Context, Hono } from "hono";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	occurrenceParamSchema,
	recurringParamSchema,
	recurringQuerySchema,
	upcomingQuerySchema,
} from "@/routes/recurring/recurring.schemas";
import {
	confirmOccurrence,
	createRecurring,
	deleteRecurring,
	getRecurring,
	listPending,
	listRecurring,
	listUpcoming,
	skipOccurrence,
	updateRecurring,
} from "@/routes/recurring/recurring.service";
import {
	dismissSuggestion,
	listSuggestions,
} from "@/routes/recurring/suggestions.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * The recurring transactions of a household. Mounted under
 * `/households/:householdId/recurring-transactions`, behind
 * `requireHouseholdMember`.
 */
export const recurringRoutes = new Hono<Env>()
	.get("/", validate("query", recurringQuerySchema), async (c) =>
		c.json(await listRecurring(viewerOf(c), c.req.valid("query"))),
	)
	.post("/", validate("json", createRecurringTransactionSchema), async (c) =>
		c.json(await createRecurring(viewerOf(c), c.req.valid("json")), 201),
	)
	// Before "/:recurringId", which would otherwise read them as ids
	.get("/pending", validate("query", recurringQuerySchema), async (c) =>
		c.json(await listPending(viewerOf(c), c.req.valid("query"))),
	)
	.post(
		"/pending/:occurrenceId/confirm",
		validate("param", occurrenceParamSchema),
		validate("json", updateTransactionSchema),
		async (c) =>
			c.json(
				await confirmOccurrence(
					viewerOf(c),
					c.req.valid("param").occurrenceId,
					c.req.valid("json"),
				),
				201,
			),
	)
	.post(
		"/pending/:occurrenceId/skip",
		validate("param", occurrenceParamSchema),
		async (c) => {
			await skipOccurrence(viewerOf(c), c.req.valid("param").occurrenceId);
			return c.body(null, 204);
		},
	)
	// Series found in the history of the accounts the member holds
	.get("/suggestions", validate("query", recurringQuerySchema), async (c) =>
		c.json(await listSuggestions(viewerOf(c), c.req.valid("query"))),
	)
	.post(
		"/suggestions/dismiss",
		validate("json", recurringSuggestionKeySchema),
		async (c) => {
			await dismissSuggestion(viewerOf(c), c.req.valid("json"));
			return c.body(null, 204);
		},
	)
	.get("/upcoming", validate("query", upcomingQuerySchema), async (c) =>
		c.json(await listUpcoming(viewerOf(c), c.req.valid("query"))),
	)
	.get("/:recurringId", validate("param", recurringParamSchema), async (c) =>
		c.json(await getRecurring(viewerOf(c), c.req.valid("param").recurringId)),
	)
	.put(
		"/:recurringId",
		validate("param", recurringParamSchema),
		validate("json", updateRecurringTransactionSchema),
		async (c) =>
			c.json(
				await updateRecurring(
					viewerOf(c),
					c.req.valid("param").recurringId,
					c.req.valid("json"),
				),
			),
	)
	.delete(
		"/:recurringId",
		validate("param", recurringParamSchema),
		async (c) => {
			await deleteRecurring(viewerOf(c), c.req.valid("param").recurringId);
			return c.body(null, 204);
		},
	);
