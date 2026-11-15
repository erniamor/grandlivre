import { calendarDateSchema } from "@repo/schemas";
import { z } from "zod";

/** The photo of a receipt, sent as a form, with the member's day. */
export const receiptFormSchema = z.object({
	photo: z.instanceof(File, { message: "receipt_photo_required" }),
	today: calendarDateSchema,
});
