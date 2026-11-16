import {
	categorizePayeeSchema,
	createDraftSchema,
	createTransactionSchema,
	RECEIPT_PHOTO_MAX_BYTES,
	updateTransactionSchema,
	VOICE_AUDIO_MAX_BYTES,
} from "@repo/schemas";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { errorBody } from "@/lib/errors";
import { resolveLocale } from "@/lib/locale";
import { validate } from "@/lib/validator";
import type { HouseholdVariables } from "@/middlewares/require-household";
import type { Viewer } from "@/routes/accounts/accounts.service";
import {
	receiptFormSchema,
	voiceFormSchema,
} from "@/routes/drafts/drafts.schemas";
import {
	draftFromReceipt,
	draftTransaction,
} from "@/routes/drafts/drafts.service";
import { transcribeNote } from "@/routes/drafts/voice.service";
import {
	categorizePayee,
	listUncategorizedPayees,
} from "@/routes/transactions/categorize.service";
import {
	transactionParamSchema,
	transactionsQuerySchema,
	uncategorizedQuerySchema,
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
	// A note dictated through the microphone, as text to read: nothing is
	// saved, the recording least of all. A larger body than elsewhere: audio.
	.post(
		"/draft/transcribe",
		bodyLimit({
			maxSize: VOICE_AUDIO_MAX_BYTES + 64 * 1024,
			onError: (c) =>
				c.json(
					errorBody("payload_too_large", "The recording is too long"),
					413,
				),
		}),
		validate("form", voiceFormSchema),
		async (c) =>
			c.json(
				await transcribeNote(
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
	// The expenses and incomes without a tag of the member's accounts, by payee
	.get(
		"/uncategorized",
		validate("query", uncategorizedQuerySchema),
		async (c) =>
			c.json(await listUncategorizedPayees(viewerOf(c), c.req.valid("query"))),
	)
	// A tag for all of a payee's expenses (or incomes) without one
	.post("/categorize", validate("json", categorizePayeeSchema), async (c) =>
		c.json(await categorizePayee(viewerOf(c), c.req.valid("json"))),
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
