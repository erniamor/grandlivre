import { ValidationError } from "@repo/resources";
import { actionErrorMessage, errorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

/** Why a statement file couldn't be read, with the line when there is one. */
export function fileErrorMessage(error: unknown): string {
	if (error instanceof ValidationError) {
		const issue = error.issues.find((each) => each.field === "file");
		if (issue?.message === "statement_unreadable" && issue.line !== undefined) {
			return m.error_statement_unreadable_line({ line: issue.line });
		}
		if (issue) {
			return errorMessage(issue.message);
		}
	}
	return actionErrorMessage(error);
}
