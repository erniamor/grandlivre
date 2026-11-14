import { NetworkError, RateLimitError, ValidationError } from "@repo/resources";
import { m } from "@/paraglide/messages";

// Error codes from @repo/schemas and the API, translated for the user
const messagesByCode: Record<string, () => string> = {
	email_invalid: m.error_email_invalid,
	code_invalid: m.error_code_invalid,
	invalid_otp: m.error_invalid_otp,
	otp_expired: m.error_otp_expired,
	too_many_attempts: m.error_too_many_attempts,
	name_required: m.error_name_required,
	name_too_long: m.error_name_too_long,
	household_name_required: m.error_household_name_required,
	household_name_too_long: m.error_household_name_too_long,
	household_currency_invalid: m.error_household_currency_invalid,
	last_owner: m.error_last_owner,
	already_member: m.error_already_member,
	email_unavailable: m.error_email_unavailable,
};

export function errorMessage(code: string): string {
	return (messagesByCode[code] ?? m.error_generic)();
}

export interface FormErrors {
	/** Message for the whole form. */
	form?: string;
	/** Message per field, keyed by field name. */
	fields: Record<string, string>;
}

/** Turns an error from @repo/resources into messages to show in a form. */
export function formErrors(error: unknown): FormErrors {
	if (error instanceof ValidationError && error.issues.length > 0) {
		return {
			fields: Object.fromEntries(
				error.issues.map((issue) => [issue.field, errorMessage(issue.message)]),
			),
		};
	}
	if (error instanceof ValidationError) {
		return { form: errorMessage(error.code), fields: {} };
	}
	if (error instanceof RateLimitError) {
		// A specific limit has its own message when its code is listed above
		return {
			form:
				error.code in messagesByCode
					? errorMessage(error.code)
					: m.error_too_many_requests(),
			fields: {},
		};
	}
	if (error instanceof NetworkError) {
		return { form: m.error_network(), fields: {} };
	}
	if (
		error instanceof Error &&
		"code" in error &&
		typeof error.code === "string"
	) {
		return { form: errorMessage(error.code), fields: {} };
	}
	return { form: m.error_generic(), fields: {} };
}

/** One message for an action outside a form that was refused, e.g. in a toast. */
export function actionErrorMessage(error: unknown): string {
	const { form, fields } = formErrors(error);
	return form ?? Object.values(fields)[0] ?? m.error_generic();
}

/**
 * Message for a change that was shown at once, then refused: an offline user
 * or a rate limit get their own message, anything else says it wasn't saved.
 */
export function saveErrorMessage(error: unknown): string {
	if (error instanceof NetworkError) {
		return m.error_network();
	}
	if (error instanceof RateLimitError) {
		return m.error_too_many_requests();
	}
	return m.error_save_failed();
}
