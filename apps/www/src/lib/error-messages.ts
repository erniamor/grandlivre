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
	account_name_required: m.error_account_name_required,
	account_name_too_long: m.error_account_name_too_long,
	account_holders_required: m.error_account_holders_required,
	account_holders_invalid: m.error_account_holders_invalid,
	amount_invalid: m.error_amount_invalid,
	amount_too_large: m.error_amount_too_large,
	currency_locked: m.error_currency_locked,
	forbidden: m.error_forbidden,
	tag_name_required: m.error_tag_name_required,
	tag_name_too_long: m.error_tag_name_too_long,
	tag_name_taken: m.error_tag_name_taken,
	tag_parent_invalid: m.error_tag_parent_invalid,
	tag_has_children: m.error_tag_has_children,
	suggested_tags_required: m.error_suggested_tags_required,
	suggested_tags_invalid: m.error_suggested_tags_invalid,
	tag_limit_reached: m.error_tag_limit_reached,
	amount_not_positive: m.error_amount_not_positive,
	date_invalid: m.error_date_invalid,
	transaction_account_required: m.error_transaction_account_required,
	transaction_account_invalid: m.error_transaction_account_invalid,
	transaction_tag_invalid: m.error_transaction_tag_invalid,
	transaction_undetermined_tagged: m.error_transaction_undetermined_tagged,
	transaction_lines_required: m.error_transaction_lines_required,
	transaction_lines_too_many: m.error_transaction_lines_too_many,
	transaction_payee_too_long: m.error_transaction_payee_too_long,
	transaction_note_too_long: m.error_transaction_note_too_long,
	transfer_same_account: m.error_transfer_same_account,
	account_archived: m.error_account_archived,
	account_has_transactions: m.error_account_has_transactions,
	tag_in_use: m.error_tag_in_use,
	report_period_invalid: m.error_report_period_invalid,
	report_period_too_long: m.error_report_period_too_long,
	draft_text_required: m.error_draft_text_required,
	draft_text_too_long: m.error_draft_text_too_long,
	draft_not_understood: m.error_draft_not_understood,
	assistant_unavailable: m.error_assistant_unavailable,
	receipt_photo_required: m.error_receipt_photo_required,
	receipt_photo_invalid: m.error_receipt_photo_invalid,
	receipt_photo_too_large: m.error_receipt_photo_too_large,
	voice_audio_required: m.error_voice_audio_required,
	voice_audio_too_long: m.error_voice_audio_too_long,
	voice_audio_invalid: m.error_voice_audio_invalid,
	voice_not_understood: m.error_voice_not_understood,
	voice_unavailable: m.error_voice_unavailable,
	statement_file_required: m.error_statement_file_required,
	statement_unreadable: m.error_statement_unreadable,
	statement_empty: m.error_statement_empty,
	statement_too_long: m.error_statement_too_long,
	statement_too_large: m.error_statement_too_large,
	statement_line_invalid: m.error_import_changed,
	statement_line_already_imported: m.error_statement_line_already_imported,
	import_account_invalid: m.error_import_account_invalid,
	import_targets_invalid: m.error_import_changed,
	import_plan_invalid: m.error_import_changed,
	import_accounts_required: m.import_nothing,
	import_transfer_invalid: m.error_import_transfer_invalid,
	import_link_invalid: m.error_import_changed,
	import_occurrence_invalid: m.error_import_changed,
	import_join_invalid: m.error_import_join_invalid,
	household_time_zone_invalid: m.error_household_time_zone_invalid,
	budget_tag_required: m.error_budget_tag_required,
	sharing_disabled: m.error_sharing_disabled,
	share_mode_invalid: m.error_share_mode_invalid,
	share_members_required: m.error_share_members_required,
	share_members_invalid: m.error_share_members_invalid,
	share_member_invalid: m.error_share_member_invalid,
	share_weight_invalid: m.error_share_weight_invalid,
	share_amounts_mismatch: m.error_share_amounts_mismatch,
	share_account_not_personal: m.error_share_account_not_personal,
	settlement_same_member: m.error_settlement_same_member,
	settlement_note_too_long: m.error_settlement_note_too_long,
	settlement_account_invalid: m.error_settlement_account_invalid,
	budget_period_invalid: m.error_budget_period_invalid,
	budget_month_invalid: m.error_budget_month_invalid,
	recurrence_unit_invalid: m.error_recurrence_unit_invalid,
	recurrence_interval_invalid: m.error_recurrence_interval_invalid,
	recurrence_mode_invalid: m.error_recurrence_mode_invalid,
	recurrence_end_before_start: m.error_recurrence_end_before_start,
	recurrence_start_in_past: m.error_recurrence_start_in_past,
	occurrence_already_handled: m.error_occurrence_already_handled,
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
