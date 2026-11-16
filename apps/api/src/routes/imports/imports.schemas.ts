import { STATEMENT_MAX_BYTES, statementTargetsSchema } from "@repo/schemas";
import { z } from "zod";

/**
 * A statement file sent to be read (a multipart form), and where its
 * accounts go: `targets`, as JSON, for those not recognized or sent
 * elsewhere.
 */
export const statementFormSchema = z.object({
	file: z
		.instanceof(File, { message: "statement_file_required" })
		.refine((file) => file.size <= STATEMENT_MAX_BYTES, "statement_too_large"),
	targets: z
		.string()
		.optional()
		.transform((text, context): unknown => {
			if (text === undefined || text === "") {
				return [];
			}
			try {
				return JSON.parse(text);
			} catch {
				context.addIssue({ code: "custom", message: "import_targets_invalid" });
				return z.NEVER;
			}
		})
		.pipe(statementTargetsSchema),
});
