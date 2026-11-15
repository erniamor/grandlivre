import { z } from "zod";

export const RECEIPT_ITEM_NAME_MAX_LENGTH = 120;
export const RECEIPT_MAX_ITEMS = 200;
export const RECEIPT_MAX_TAXES = 10;
/** Largest photo of a receipt sent to the assistant: 5 MB. */
export const RECEIPT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** An amount as printed on a receipt, in minor units: negative for a discount. */
const printedAmountSchema = z.number("amount_invalid").int("amount_invalid");

/**
 * What a receipt says, kept with the transaction recorded from it: the
 * photo itself is never stored. Amounts in minor units.
 */
export const receiptSchema = z.object({
	merchant: z.string().trim().max(RECEIPT_ITEM_NAME_MAX_LENGTH).nullable(),
	/** In the order printed; a discount is negative. */
	items: z
		.array(
			z.object({
				name: z.string().trim().max(RECEIPT_ITEM_NAME_MAX_LENGTH),
				amount: printedAmountSchema,
			}),
		)
		.max(RECEIPT_MAX_ITEMS),
	/** Before taxes; null when the receipt doesn't print it. */
	subtotal: printedAmountSchema.nullable(),
	/** Each tax as printed: "TPS", "TVQ", "GST"... */
	taxes: z
		.array(
			z.object({
				name: z.string().trim().max(40),
				amount: printedAmountSchema,
			}),
		)
		.max(RECEIPT_MAX_TAXES),
	/** What was paid. */
	total: printedAmountSchema.positive("amount_not_positive"),
});

export type Receipt = z.infer<typeof receiptSchema>;
