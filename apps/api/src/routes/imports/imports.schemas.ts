import {
	STATEMENT_MAX_BYTES,
	statementImportPlanSchema,
	statementTargetsSchema,
} from "@repo/schemas";
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

const fileSchema = z
	.instanceof(File, { message: "statement_file_required" })
	.refine((file) => file.size <= STATEMENT_MAX_BYTES, "statement_too_large");

/** A form field holding JSON, read before its schema checks it. */
function jsonField(message: string, empty: unknown) {
	return z
		.string()
		.optional()
		.transform((text, context): unknown => {
			if (text === undefined || text === "") {
				return empty;
			}
			try {
				return JSON.parse(text);
			} catch {
				context.addIssue({ code: "custom", message });
				return z.NEVER;
			}
		});
}

/**
 * A statement file sent to be read (a multipart form), and where its
 * accounts go: `targets`, as JSON, for those not recognized or sent
 * elsewhere.
 */
export const statementFormSchema = z.object({
	file: fileSchema,
	targets: jsonField("import_targets_invalid", []).pipe(statementTargetsSchema),
});

/**
 * A statement file sent again to be imported, with what to do of it:
 * `plan`, as JSON. The file is read again: what is imported is what it
 * says, never what the browser says it says.
 */
export const statementImportFormSchema = z.object({
	file: fileSchema,
	plan: jsonField("import_plan_invalid", undefined).pipe(
		statementImportPlanSchema,
	),
});

export const importParamSchema = z.object({
	importId: z.uuid(),
});

export const importsQuerySchema = paginationQuerySchema({
	defaultPageSize: 20,
	maxPageSize: 100,
});
