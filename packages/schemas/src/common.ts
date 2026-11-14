import { z } from "zod";

// Dates travel as ISO 8601 strings in JSON
export const dateTimeSchema = z.iso.datetime();

/**
 * Largest amount accepted, in minor units (cents): far above a family's
 * finances, and small enough for sums to stay exact in JavaScript.
 */
export const MAX_AMOUNT = 999_999_999_999;

/**
 * An amount of money in minor units of the household's currency (cents),
 * always an integer: 72.50 $ is 7250. Negative for money owed or spent.
 */
export const amountSchema = z
	.number("amount_invalid")
	.int("amount_invalid")
	.min(-MAX_AMOUNT, "amount_too_large")
	.max(MAX_AMOUNT, "amount_too_large");

export const paginationSchema = z.object({
	page: z.number().int().min(1),
	pageSize: z.number().int().min(1),
	total: z.number().int().min(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Response envelope of a paginated list: `{ data, pagination }`. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
	return z.object({ data: z.array(item), pagination: paginationSchema });
}

export interface Paginated<T> {
	data: T[];
	pagination: Pagination;
}

// Error messages are codes, translated by the front ends.
// trim() and toLowerCase(): emails are compared case-insensitively.
export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email("email_invalid"));

/** One invalid field of a 422 error. */
export const validationIssueSchema = z.object({
	/** Dotted path of the field, empty for the whole input. */
	field: z.string(),
	/** Error code, e.g. "name_required". */
	message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/** Body of every error response of the API. */
export const apiErrorBodySchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.unknown().optional(),
	}),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
