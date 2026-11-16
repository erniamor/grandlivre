import type { ShareSplit } from "@repo/schemas";
import { Checkbox, Input, Label } from "@repo/ui";
import { useId } from "react";
import { FormAlert } from "@/components/FormAlert";
import type { ShareFormState } from "@/features/sharing/share-form";
import type { SharingContext } from "@/features/sharing/sharing-query";
import { m } from "@/paraglide/messages";

interface SharesFieldProps {
	value: ShareFormState;
	onChange: (state: ShareFormState) => void;
	context: SharingContext;
	error?: string;
}

const modeLabels: Record<ShareSplit["mode"], () => string> = {
	equal: m.share_mode_equal,
	weights: m.share_mode_weights,
	amounts: m.share_mode_amounts,
};

/**
 * How a transaction paid from one member's own account is shared among
 * members: in equal parts, in proportions, or by amounts.
 */
export function SharesField({
	value,
	onChange,
	context,
	error,
}: SharesFieldProps) {
	const id = useId();
	const change = (fields: Partial<ShareFormState>) =>
		onChange({ ...value, ...fields });

	return (
		<fieldset className="grid gap-3 rounded-lg border border-border p-4">
			<legend className="sr-only">{m.share_legend()}</legend>
			<div className="flex items-start gap-3">
				<Checkbox
					id={`${id}-on`}
					checked={value.on}
					onCheckedChange={(checked) => change({ on: checked === true })}
				/>
				<div className="grid gap-1">
					<Label htmlFor={`${id}-on`}>{m.share_toggle_label()}</Label>
					<p className="text-muted-foreground text-sm">
						{m.share_toggle_hint()}
					</p>
				</div>
			</div>
			{value.on && (
				<>
					<div
						role="radiogroup"
						aria-label={m.share_mode_label()}
						className="flex flex-wrap gap-2"
					>
						{(["equal", "weights", "amounts"] as const).map((mode) => (
							<label
								key={mode}
								className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
							>
								<input
									type="radio"
									name={`${id}-mode`}
									value={mode}
									checked={value.mode === mode}
									onChange={() => change({ mode })}
									className="accent-primary"
								/>
								{modeLabels[mode]()}
							</label>
						))}
					</div>
					<ul className="grid gap-2">
						{context.members.map(({ userId, name }) => (
							<li key={userId} className="flex items-center gap-3">
								{value.mode === "equal" ? (
									<>
										<Checkbox
											id={`${id}-${userId}`}
											checked={value.included.includes(userId)}
											onCheckedChange={(checked) =>
												change({
													included:
														checked === true
															? [...value.included, userId]
															: value.included.filter(
																	(each) => each !== userId,
																),
												})
											}
										/>
										<Label htmlFor={`${id}-${userId}`}>{name}</Label>
									</>
								) : (
									<>
										<Label
											htmlFor={`${id}-${userId}`}
											className="min-w-24 flex-1"
										>
											{name}
										</Label>
										<Input
											id={`${id}-${userId}`}
											className="w-28"
											inputMode={
												value.mode === "weights" ? "numeric" : "decimal"
											}
											autoComplete="off"
											aria-label={
												value.mode === "weights"
													? m.share_weight_label({ name })
													: m.share_amount_label({ name })
											}
											value={
												(value.mode === "weights"
													? value.weights
													: value.amounts)[userId] ?? ""
											}
											onChange={(event) =>
												value.mode === "weights"
													? change({
															weights: {
																...value.weights,
																[userId]: event.target.value,
															},
														})
													: change({
															amounts: {
																...value.amounts,
																[userId]: event.target.value,
															},
														})
											}
										/>
									</>
								)}
							</li>
						))}
					</ul>
					<p className="text-muted-foreground text-sm">
						{value.mode === "weights"
							? m.share_weights_hint()
							: value.mode === "amounts"
								? m.share_amounts_hint()
								: m.share_equal_hint()}
					</p>
				</>
			)}
			<FormAlert message={error} />
		</fieldset>
	);
}
