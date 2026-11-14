import type { Household, HouseholdMember, HouseholdRole } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SelectField } from "@/components/SelectField";
import { roleLabels, roleOptions } from "@/features/households/role-options";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface MemberItemProps {
	household: Household;
	member: HouseholdMember;
	/** The member is the signed-in user. */
	isMe: boolean;
	/** Called after a change of role or a removal; `left` when the user left. */
	onChanged: (change: { self: boolean; left: boolean }) => void | Promise<void>;
}

/**
 * One member of the household. Owners change roles and remove members;
 * everyone can leave.
 */
export function MemberItem({
	household,
	member,
	isMe,
	onChanged,
}: MemberItemProps) {
	const name = member.name || member.email;
	const isOwner = household.role === "owner";
	const onError = (error: unknown) => {
		toast.error(actionErrorMessage(error));
	};
	const changeRole = useMutation({
		mutationFn: (role: HouseholdRole) =>
			getApi().households.members.update(household.id, member.userId, {
				role,
			}),
		onSuccess: () => onChanged({ self: isMe, left: false }),
		onError,
	});
	const remove = useMutation({
		mutationFn: () =>
			getApi().households.members.remove(household.id, member.userId),
		onSuccess: () => onChanged({ self: isMe, left: isMe }),
		onError,
	});
	const isPending = changeRole.isPending || remove.isPending;

	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="grid min-w-40 flex-1 gap-0.5">
				<p className="break-words font-medium">
					{name}
					{isMe && (
						<span className="font-normal text-muted-foreground">
							{" "}
							({m.member_you()})
						</span>
					)}
				</p>
				{member.name && (
					<p className="break-all text-muted-foreground text-sm">
						{member.email}
					</p>
				)}
			</div>
			{isOwner ? (
				<SelectField
					label={m.member_role_label({ name })}
					hideLabel
					value={changeRole.isPending ? changeRole.variables : member.role}
					options={roleOptions()}
					onChange={(role) => changeRole.mutate(role)}
					disabled={isPending}
					tone="default"
				/>
			) : (
				<p className="text-muted-foreground text-sm">
					{roleLabels[member.role]()}
				</p>
			)}
			{isMe ? (
				<ConfirmButton
					label={m.household_leave_button()}
					title={m.household_leave_title({ household: household.name })}
					description={m.household_leave_text()}
					confirmLabel={m.household_leave_confirm()}
					pending={isPending}
					onConfirm={() => remove.mutate()}
				/>
			) : (
				isOwner && (
					<ConfirmButton
						label={m.member_remove_button()}
						ariaLabel={m.member_remove_label({ name })}
						title={m.member_remove_title({ name })}
						description={m.member_remove_text()}
						confirmLabel={m.member_remove_button()}
						pending={isPending}
						onConfirm={() => remove.mutate()}
					/>
				)
			)}
		</li>
	);
}
