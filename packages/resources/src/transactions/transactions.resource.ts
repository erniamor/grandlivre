import {
	type CategorizePayee,
	type CategorizeResult,
	type CreateDraft,
	type CreateTransaction,
	categorizePayeeSchema,
	categorizeResultSchema,
	createDraftSchema,
	createTransactionSchema,
	type PayeeTagSuggestions,
	paginatedSchema,
	payeeTagSuggestionsSchema,
	RECEIPT_PHOTO_MAX_BYTES,
	type SetAsideUndetermined,
	type SuggestPayeeTags,
	setAsideUndeterminedSchema,
	suggestPayeeTagsSchema,
	type Transaction,
	type TransactionDraft,
	type TransactionType,
	type Transcription,
	transactionDraftSchema,
	transactionSchema,
	transcriptionSchema,
	type UncategorizedCount,
	type UncategorizedPayee,
	type UpdateTransaction,
	uncategorizedCountSchema,
	uncategorizedPayeeSchema,
	updateTransactionSchema,
	VOICE_AUDIO_MAX_BYTES,
} from "@repo/schemas";
import {
	type Page,
	type PageOptions,
	segment,
	toPage,
	withQuery,
} from "../api/page";
import { ValidationError } from "../errors";
import { type ApiClient, parseInput } from "../http/client";

const transactionsPageSchema = paginatedSchema(transactionSchema);
const uncategorizedPageSchema = paginatedSchema(uncategorizedPayeeSchema);

const transactionsPath = (householdId: string) =>
	`/households/${segment(householdId)}/transactions`;

/** The photo of a receipt, with the member's day. */
export interface CreateReceiptDraft {
	/** The image, at most RECEIPT_PHOTO_MAX_BYTES: a JPEG, PNG, WebP or GIF. */
	photo: Blob;
	/** Today on the member's device ("2026-11-15"). */
	today: string;
}

const receiptDaySchema = createDraftSchema.pick({ today: true });

/** The photo's checks the API also makes, before sending megabytes for nothing. */
function checkPhoto(photo: Blob): void {
	const message =
		photo.size === 0
			? "receipt_photo_required"
			: photo.size > RECEIPT_PHOTO_MAX_BYTES
				? "receipt_photo_too_large"
				: null;
	if (message) {
		throw new ValidationError(422, "validation_error", "Invalid request", [
			{ field: "photo", message },
		]);
	}
}

const transactionPath = (householdId: string, transactionId: string) =>
	`${transactionsPath(householdId)}/${segment(transactionId)}`;

/** What narrows a list of transactions; every filter is optional. */
export interface TransactionFilters {
	/** The transactions of this account, transfers it receives included. */
	accountId?: string;
	/** The transactions with a line on this tag or on a tag under it. */
	tagId?: string;
	type?: TransactionType;
	/** From this day on, included: "2026-11-01". */
	from?: string;
	/** Up to this day, included. */
	to?: string;
	/**
	 * Words each found in the payee, the note, or a receipt's merchant or
	 * items, accents and case aside.
	 */
	q?: string;
	/** The transaction's total, in minor units: at least this much. */
	minAmount?: number;
	/** At most this much. */
	maxAmount?: number;
	/**
	 * The expenses and incomes with a line without a tag: still to
	 * categorize ("to-define"), or set aside as undetermined.
	 */
	untagged?: "to-define" | "undetermined";
}

/**
 * The transactions of a household: expenses, incomes and transfers between
 * its accounts. Amounts are positive integers in minor units of the
 * household's currency (cents); the type says which way the money goes.
 * A transaction the user may not see (unknown, or on an account that only
 * shows its balance) rejects with a NotFoundError; a change on an account
 * they don't hold with a ForbiddenError.
 */
export function createTransactionsResource(client: ApiClient) {
	return {
		/** The transactions the user may see, the most recent day first. */
		async list(
			householdId: string,
			{
				page,
				pageSize,
				signal,
				...filters
			}: PageOptions & TransactionFilters = {},
		): Promise<Page<Transaction>> {
			return toPage(
				await client.request({
					path: withQuery(transactionsPath(householdId), {
						...filters,
						page,
						pageSize,
					}),
					response: transactionsPageSchema,
					signal,
				}),
			);
		},

		async get(
			householdId: string,
			transactionId: string,
			options: { signal?: AbortSignal } = {},
		): Promise<Transaction> {
			return client.request({
				path: transactionPath(householdId, transactionId),
				response: transactionSchema,
				signal: options.signal,
			});
		},

		/**
		 * Records a transaction on an account the user holds. An account or a
		 * tag from outside the household rejects with a ValidationError on its
		 * field; an archived account with an ApiError `account_archived` (409).
		 */
		async create(
			householdId: string,
			input: CreateTransaction,
		): Promise<Transaction> {
			return client.request({
				method: "POST",
				path: transactionsPath(householdId),
				body: parseInput(createTransactionSchema, input),
				response: transactionSchema,
			});
		},

		/**
		 * Replaces a transaction with the one given, as a whole: what isn't
		 * given again is lost. Rejects like `create()`.
		 */
		async replace(
			householdId: string,
			transactionId: string,
			input: UpdateTransaction,
		): Promise<Transaction> {
			return client.request({
				method: "PUT",
				path: transactionPath(householdId, transactionId),
				body: parseInput(updateTransactionSchema, input),
				response: transactionSchema,
			});
		},

		/**
		 * Turns a note typed or dictated by the member ("gas 72 $") into a
		 * draft transaction, with the household's assistant. Nothing is saved
		 * and no tag is created: show the draft for the member to review, then
		 * record it with `create()`. `today` is the member's day ("2026-11-15").
		 * Rejects with an ApiError `draft_not_understood` (422) for a note it
		 * couldn't read, `assistant_unavailable` (503) when the assistant can't
		 * be reached, and a RateLimitError beyond the notes allowed per hour.
		 */
		async draft(
			householdId: string,
			input: CreateDraft,
		): Promise<TransactionDraft> {
			return client.request({
				method: "POST",
				path: `${transactionsPath(householdId)}/draft`,
				body: parseInput(createDraftSchema, input),
				response: transactionDraftSchema,
			});
		},

		/**
		 * Turns the photo of a receipt into a draft expense, with the
		 * household's assistant: one line per tag, the taxes shared out, and
		 * the receipt's details (`receipt`) to record with it. Nothing is
		 * saved, the photo isn't kept. `warnings` holds
		 * `receipt_total_mismatch` when the receipt's figures don't add up to
		 * its total. Rejects with a ValidationError on `photo`
		 * (`receipt_photo_required`, `receipt_photo_too_large` before sending,
		 * `receipt_photo_invalid` from the API for a file that isn't an image),
		 * an ApiError `draft_not_understood` (422) for a photo it couldn't
		 * read, `assistant_unavailable` (503), and a RateLimitError beyond the
		 * receipts allowed per hour.
		 */
		async draftFromReceipt(
			householdId: string,
			{ photo, today }: CreateReceiptDraft,
		): Promise<TransactionDraft> {
			checkPhoto(photo);
			const form = new FormData();
			// A name makes it a file for the API, whatever the Blob
			form.set("photo", photo, "receipt");
			form.set("today", parseInput(receiptDaySchema, { today }).today);
			return client.request({
				method: "POST",
				path: `${transactionsPath(householdId)}/draft/receipt`,
				body: form,
				response: transactionDraftSchema,
			});
		},

		async remove(householdId: string, transactionId: string): Promise<void> {
			await client.request({
				method: "DELETE",
				path: transactionPath(householdId, transactionId),
			});
		},

		/**
		 * The user's expenses and incomes without a tag, by payee (payees
		 * alike in their letters together), the most transactions first.
		 */
		async uncategorized(
			householdId: string,
			{ page, pageSize, signal }: PageOptions = {},
		): Promise<Page<UncategorizedPayee>> {
			return toPage(
				await client.request({
					path: withQuery(`${transactionsPath(householdId)}/uncategorized`, {
						page,
						pageSize,
					}),
					response: uncategorizedPageSchema,
					signal,
				}),
			);
		},

		/** Tags every expense (or income) without a tag of a payee, on the user's accounts. */
		async categorize(
			householdId: string,
			input: CategorizePayee,
		): Promise<CategorizeResult> {
			return client.request({
				method: "POST",
				path: `${transactionsPath(householdId)}/categorize`,
				body: parseInput(categorizePayeeSchema, input),
				response: categorizeResultSchema,
			});
		},

		/**
		 * How many of the user's expenses and incomes without a tag are dated
		 * before a day ("2026-01-01", excluded): what setting them aside takes.
		 */
		async countUncategorized(
			householdId: string,
			{ before, signal }: { before: string; signal?: AbortSignal },
		): Promise<UncategorizedCount> {
			return client.request({
				path: withQuery(
					`${transactionsPath(householdId)}/uncategorized/count`,
					{
						before,
					},
				),
				response: uncategorizedCountSchema,
				signal,
			});
		},

		/**
		 * Sets aside as undetermined the user's expenses (or incomes) without a
		 * tag of a payee, or all those before a day: they leave the ones to
		 * categorize, without a tag nor teaching anything.
		 */
		async setAside(
			householdId: string,
			input: SetAsideUndetermined,
		): Promise<CategorizeResult> {
			return client.request({
				method: "POST",
				path: `${transactionsPath(householdId)}/uncategorized/set-aside`,
				body: parseInput(setAsideUndeterminedSchema, input),
				response: categorizeResultSchema,
			});
		},

		/**
		 * The assistant's tag for payees without one (TAG_SUGGESTION_MAX_PAYEES
		 * at most): one of the household's tags, or null; nothing is applied.
		 * Rejects with an ApiError `assistant_unavailable` (503), and a
		 * RateLimitError beyond the requests allowed per hour.
		 */
		async suggestTags(
			householdId: string,
			input: SuggestPayeeTags,
		): Promise<PayeeTagSuggestions> {
			return client.request({
				method: "POST",
				path: `${transactionsPath(householdId)}/uncategorized/suggest`,
				body: parseInput(suggestPayeeTagsSchema, input),
				response: payeeTagSuggestionsSchema,
			});
		},

		/**
		 * A note dictated through the microphone, as text to read before it is
		 * drafted. Rejects with a ValidationError on `audio` for an empty or too
		 * long recording (checked before sending) or one that isn't audio, an
		 * ApiError `voice_not_understood` (422) when nothing was heard,
		 * `voice_unavailable` (503), and a RateLimitError beyond the recordings
		 * allowed per hour.
		 */
		async transcribe(
			householdId: string,
			{ audio }: { audio: Blob },
		): Promise<Transcription> {
			const message =
				audio.size === 0
					? "voice_audio_required"
					: audio.size > VOICE_AUDIO_MAX_BYTES
						? "voice_audio_too_long"
						: null;
			if (message) {
				throw new ValidationError(422, "validation_error", "Invalid request", [
					{ field: "audio", message },
				]);
			}
			const form = new FormData();
			// A name makes it a file for the API, whatever the Blob
			form.set("audio", audio, "note");
			return client.request({
				method: "POST",
				path: `${transactionsPath(householdId)}/draft/transcribe`,
				body: form,
				response: transcriptionSchema,
			});
		},
	};
}

export type TransactionsResource = ReturnType<
	typeof createTransactionsResource
>;
