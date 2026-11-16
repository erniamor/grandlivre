import {
	paginatedSchema,
	STATEMENT_MAX_BYTES,
	type StatementImport,
	type StatementImportPlan,
	type StatementPreview,
	type StatementTargets,
	statementImportPlanSchema,
	statementImportSchema,
	statementPreviewSchema,
	statementTargetsSchema,
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

const importsPageSchema = paginatedSchema(statementImportSchema);

const importsPath = (householdId: string) =>
	`/households/${segment(householdId)}/imports`;

/** A statement file is sent only when there is one, small enough. */
function checkFile(file: Blob): void {
	const message =
		file.size === 0
			? "statement_empty"
			: file.size > STATEMENT_MAX_BYTES
				? "statement_too_large"
				: null;
	if (message) {
		throw new ValidationError(422, "validation_error", "Invalid request", [
			{ field: "file", message },
		]);
	}
}

/** The file and its JSON fields, as a multipart form. */
function statementForm(file: Blob, fields: Record<string, unknown>): FormData {
	const form = new FormData();
	// A name makes it a file for the API, whatever the Blob
	form.set("file", file, "statement.csv");
	for (const [name, value] of Object.entries(fields)) {
		form.set(name, JSON.stringify(value));
	}
	return form;
}

/**
 * Bank statements imported into a household's accounts: a file is read and
 * compared first (`preview`, nothing saved), then imported as the member
 * decided (`create`), which they can undo (`remove`). The file is sent
 * both times: the API keeps none.
 */
export function createImportsResource(client: ApiClient) {
	return {
		/**
		 * The file read and compared with the household: its accounts, where
		 * they go (recognized, or `targets`), and each line's standing. Rejects
		 * with a ValidationError on `file` for a file that can't be read
		 * (`statement_unreadable`, with the `line`), or on `targets`.
		 */
		async preview(
			householdId: string,
			{ file, targets = [] }: { file: Blob; targets?: StatementTargets },
		): Promise<StatementPreview> {
			checkFile(file);
			return client.request({
				method: "POST",
				path: `${importsPath(householdId)}/preview`,
				body: statementForm(file, {
					targets: parseInput(statementTargetsSchema, targets),
				}),
				response: statementPreviewSchema,
			});
		},

		/**
		 * Imports the file as `plan` says, all of it or nothing. Rejects with a
		 * ValidationError naming the decision that can't be followed, or an
		 * ApiError `statement_line_already_imported` (409) when a line came in
		 * since the preview.
		 */
		async create(
			householdId: string,
			{ file, plan }: { file: Blob; plan: StatementImportPlan },
		): Promise<StatementImport> {
			checkFile(file);
			return client.request({
				method: "POST",
				path: importsPath(householdId),
				body: statementForm(file, {
					plan: parseInput(statementImportPlanSchema, plan),
				}),
				response: statementImportSchema,
			});
		},

		/** The member's own imports, the most recent first. */
		async list(
			householdId: string,
			{ page, pageSize, signal }: PageOptions = {},
		): Promise<Page<StatementImport>> {
			return toPage(
				await client.request({
					path: withQuery(importsPath(householdId), { page, pageSize }),
					response: importsPageSchema,
					signal,
				}),
			);
		},

		/**
		 * Undoes one of the member's imports: what it created goes, what it
		 * tied to lines stays.
		 */
		async remove(householdId: string, importId: string): Promise<void> {
			await client.request({
				method: "DELETE",
				path: `${importsPath(householdId)}/${segment(importId)}`,
			});
		},
	};
}

export type ImportsResource = ReturnType<typeof createImportsResource>;
