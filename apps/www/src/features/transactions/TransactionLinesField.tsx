import { Button } from "@repo/ui";
import { PlusIcon, SplitIcon, XIcon } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import {
	draftTotal,
	emptyLine,
	type LineDraft,
} from "@/features/transactions/transaction-form";
import { formatAmount } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface TransactionLinesFieldProps {
	lines: LineDraft[];
	onChange: (lines: LineDraft[]) => void;
	/** The tags to choose among, the first one standing for "uncategorized". */
	tagOptions: SelectOption<string>[];
	currency: string;
	/** A transfer has one amount, no tag, and isn't split. */
	amountOnly: boolean;
	/** Error messages by field: "lines.0.amount", "lines.1.tagId"... */
	errors: Record<string, string>;
}

/**
 * The amount and the tag of a transaction. One line most of the time; an
 * expense or an income can be split into several, each with its own tag.
 */
export function TransactionLinesField({
	lines,
	onChange,
	tagOptions,
	currency,
	amountOnly,
	errors,
}: TransactionLinesFieldProps) {
	const locale = getLocale();
	const update = (key: string, change: Partial<LineDraft>) =>
		onChange(
			lines.map((line) => (line.key === key ? { ...line, ...change } : line)),
		);
	const [first] = lines;

	if (first && (amountOnly || lines.length === 1)) {
		return (
			<div className="grid gap-4">
				<TextField
					label={m.transaction_amount_label()}
					inputMode="decimal"
					autoComplete="off"
					value={first.amount}
					onChange={(event) =>
						update(first.key, { amount: event.target.value })
					}
					required
					error={errors["lines.0.amount"]}
				/>
				{!amountOnly && (
					<>
						<SelectField
							label={m.transaction_tag_label()}
							value={first.tagId}
							options={tagOptions}
							onChange={(tagId) => update(first.key, { tagId })}
							tone="default"
							className="grid items-stretch font-medium"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="justify-self-start"
							onClick={() => onChange([...lines, emptyLine()])}
						>
							<SplitIcon aria-hidden />
							{m.transaction_split_button()}
						</Button>
					</>
				)}
			</div>
		);
	}

	const total = draftTotal(lines, currency, locale);
	return (
		<fieldset className="grid gap-4">
			<legend className="mb-2 font-medium text-sm">
				{m.transaction_lines_label()}
			</legend>
			{lines.map((line, index) => {
				const n = index + 1;
				return (
					<div
						key={line.key}
						className="grid gap-3 rounded-lg border border-border p-3"
					>
						<div className="flex items-start gap-2">
							<div className="flex-1">
								<TextField
									label={m.transaction_line_amount_label({ n })}
									inputMode="decimal"
									autoComplete="off"
									value={line.amount}
									onChange={(event) =>
										update(line.key, { amount: event.target.value })
									}
									required
									error={errors[`lines.${index}.amount`]}
								/>
							</div>
							<IconButton
								label={m.transaction_line_remove_label({ n })}
								tooltip={m.transaction_line_remove_tooltip()}
								icon={XIcon}
								className="mt-6"
								onClick={() =>
									onChange(lines.filter((other) => other.key !== line.key))
								}
							/>
						</div>
						<SelectField
							label={m.transaction_line_tag_label({ n })}
							value={line.tagId}
							options={tagOptions}
							onChange={(tagId) => update(line.key, { tagId })}
							tone="default"
							className="grid items-stretch font-medium"
						/>
						{errors[`lines.${index}.tagId`] && (
							<p className="text-destructive text-sm">
								{errors[`lines.${index}.tagId`]}
							</p>
						)}
					</div>
				);
			})}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onChange([...lines, emptyLine()])}
				>
					<PlusIcon aria-hidden />
					{m.transaction_line_add_button()}
				</Button>
				<p className="font-medium tabular-nums">
					{m.transaction_total({
						total: total === null ? "—" : formatAmount(total, currency, locale),
					})}
				</p>
			</div>
		</fieldset>
	);
}
