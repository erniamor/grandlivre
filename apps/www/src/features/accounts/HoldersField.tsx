import type { HouseholdMember } from "@repo/schemas";
import { Checkbox, Label } from "@repo/ui";
import { useId } from "react";
import { m } from "@/paraglide/messages";

interface HoldersFieldProps {
	members: HouseholdMember[];
	/** Identifiers of the members who hold the account. */
	value: string[];
	onChange: (holderIds: string[]) => void;
	/** A member who can't be unchecked: whoever creates an account holds it. */
	lockedId?: string;
	error?: string;
}

/** Chooses the holders of an account among the members of the household. */
export function HoldersField({
	members,
	value,
	onChange,
	lockedId,
	error,
}: HoldersFieldProps) {
	const id = useId();
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;

	return (
		<fieldset
			className="grid gap-2"
			aria-describedby={error ? `${hintId} ${errorId}` : hintId}
		>
			<legend className="mb-2 font-medium text-sm">
				{m.account_holders_label()}
			</legend>
			{members.map((member) => {
				const checkboxId = `${id}-${member.userId}`;
				return (
					<div key={member.userId} className="flex items-center gap-2">
						<Checkbox
							id={checkboxId}
							checked={value.includes(member.userId)}
							disabled={member.userId === lockedId}
							onCheckedChange={(checked) =>
								onChange(
									checked === true
										? [...value, member.userId]
										: value.filter((holderId) => holderId !== member.userId),
								)
							}
						/>
						<Label htmlFor={checkboxId} className="font-normal">
							{member.name || member.email}
						</Label>
					</div>
				);
			})}
			<p id={hintId} className="text-muted-foreground text-sm">
				{m.account_holders_hint()}
			</p>
			{error && (
				<p id={errorId} className="text-destructive text-sm">
					{error}
				</p>
			)}
		</fieldset>
	);
}
