import type { Account, StatementPreviewLine } from "@repo/schemas";
import { FormAlert } from "@/components/FormAlert";
import { SelectField, type SelectOption } from "@/components/SelectField";
import {
	actionOf,
	choiceForAction,
	type LineAction,
	type LineChoice,
	lineActions,
} from "@/features/imports/import-draft";
import { formatShortDay } from "@/lib/dates";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface LineChoiceFieldProps {
	line: StatementPreviewLine;
	choice: LineChoice;
	/** Whether the line's standing holds where its account goes. */
	holds: boolean;
	/** The account the line's pair goes to, for a transfer seen from both. */
	pairName: string | null;
	/** The account the transaction it matches is on. */
	matchAccountName: string | null;
	transferAccounts: Account[];
	tagOptions: SelectOption<string>[];
	/** Says a transfer's account is missing. */
	missing?: string;
	onChange: (choice: LineChoice) => void;
}

/** What becomes of a line: its action, then its tag or the account of its transfer. */
export function LineChoiceField({
	line,
	choice,
	holds,
	pairName,
	matchAccountName,
	transferAccounts,
	tagOptions,
	missing,
	onChange,
}: LineChoiceFieldProps) {
	const locale = getLocale();
	const labels: Record<LineAction, () => string> = {
		link: () =>
			m.import_action_link({
				payee: line.match?.payee || m.transaction_uncategorized(),
				date: formatShortDay(line.match?.date ?? line.date, locale),
			}),
		confirm: () =>
			m.import_action_confirm({
				payee: line.occurrence?.payee || m.transaction_uncategorized(),
			}),
		join: () =>
			m.import_action_join({
				account: matchAccountName ?? "",
				payee: line.match?.payee || m.transaction_uncategorized(),
				date: formatShortDay(line.match?.date ?? line.date, locale),
			}),
		pair: () => m.import_action_pair({ account: pairName ?? "" }),
		create: line.amount < 0 ? m.import_action_expense : m.import_action_income,
		transfer: m.import_action_transfer,
		skip: m.import_action_skip,
	};
	const actions = lineActions(line, holds).filter(
		(action) => action !== "pair" || pairName !== null,
	);

	return (
		<div className="grid gap-2 sm:grid-cols-2">
			<SelectField<LineAction>
				label={m.import_line_action_label()}
				hideLabel
				value={actionOf(choice)}
				options={actions.map((action) => ({
					value: action,
					label: labels[action](),
				}))}
				onChange={(action) => onChange(choiceForAction(action, line))}
				tone="default"
			/>
			{choice.action === "create" && (
				<SelectField
					label={m.transaction_tag_label()}
					hideLabel
					value={choice.tagId ?? ""}
					options={tagOptions}
					onChange={(tagId) => onChange({ ...choice, tagId: tagId || null })}
					tone="default"
				/>
			)}
			{choice.action === "transfer" && !choice.pair && (
				<div className="grid gap-1">
					<SelectField
						label={
							line.amount < 0
								? m.import_transfer_to_label()
								: m.import_transfer_from_label()
						}
						hideLabel
						value={choice.accountId ?? ""}
						options={[
							{ value: "", label: m.import_transfer_choose() },
							...transferAccounts.map((account) => ({
								value: account.id,
								label: account.name,
							})),
						]}
						onChange={(accountId) =>
							onChange({ ...choice, accountId: accountId || null })
						}
						tone="default"
					/>
					<FormAlert message={missing} />
				</div>
			)}
		</div>
	);
}
