import {
	createDraftSchema,
	createTransactionSchema,
	RECEIPT_PHOTO_MAX_BYTES,
	updateTransactionSchema,
} from "@repo/schemas";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { errorBody } from "@/lib/errors";
import { resolveLocale } from "@/lib/locale";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import { receiptFormSchema } from "@/routes/drafts/drafts.schemas";
import {
	draftFromReceipt,
	draftTransaction,
} from "@/routes/drafts/drafts.service";
import {
	transactionParamSchema,
	transactionsQuerySchema,
} from "@/routes/transactions/transactions.schemas";
import {
	createTransaction,
	deleteTransaction,
	getTransaction,
	listTransactions,
	updateTransaction,
} from "@/routes/transactions/transactions.service";

type Env = { Variables: HouseholdVariables };

const viewerOf = (c: Context<Env>): Viewer => ({
	userId: c.get("user").id,
	membership: c.get("membership"),
});

/**
 * The transactions of a household. Mounted under
 * `/households/:householdId/transactions`, behind `requireHouseholdMember`.
 */
export const transactionRoutes = new Hono<Env>()
	.get("/", validate("query", transactionsQuerySchema), async (c) =>
		c.json(await listTransactions(viewerOf(c), c.req.valid("query"))),
	)
	.post("/", validate("json", createTransactionSchema), async (c) =>
		c.json(await createTransaction(viewerOf(c), c.req.valid("json")), 201),
	)
	// The photo of a receipt turned into a draft to review: nothing is saved,
	// the photo least of all. A larger body than elsewhere: a photo.
	.post(
		"/draft/receipt",
		bodyLimit({
			maxSize: RECEIPT_PHOTO_MAX_BYTES + 64 * 1024,
			onError: (c) =>
				c.json(errorBody("payload_too_large", "The photo is too large"), 413),
		}),
		validate("form", receiptFormSchema),
		async (c) =>
			c.json(
				await draftFromReceipt(
					viewerOf(c),
					c.req.valid("form"),
					resolveLocale(c.req.header("accept-language")),
				),
			),
	)
	// A note turned into a draft to review: nothing is saved
	.post("/draft", validate("json", createDraftSchema), async (c) =>
		c.json(
			await draftTransaction(
				viewerOf(c),
				c.req.valid("json"),
				resolveLocale(c.req.header("accept-language")),
			),
		),
	)
	.get(
		"/:transactionId",
		validate("param", transactionParamSchema),
		async (c) =>
			c.json(
				await getTransaction(viewerOf(c), c.req.valid("param").transactionId),
			),
	)
	// PUT, not PATCH: the whole transaction is sent and replaces the previous one
	.put(
		"/:transactionId",
		validate("param", transactionParamSchema),
		validate("json", updateTransactionSchema),
		async (c) =>
			c.json(
				await updateTransaction(
					viewerOf(c),
					c.req.valid("param").transactionId,
					c.req.valid("json"),
				),
			),
	)
	.delete(
		"/:transactionId",
		validate("param", transactionParamSchema),
		async (c) => {
			await deleteTransaction(viewerOf(c), c.req.valid("param").transactionId);
			return c.body(null, 204);
		},
	);
