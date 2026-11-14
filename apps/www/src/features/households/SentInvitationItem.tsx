import type { HouseholdInvitation } from "@repo/schemas";
import { Button, toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface SentInvitationItemProps {
	householdId: string;
	invitation: HouseholdInvitation;
	/** Owners send the invitation again or cancel it. */
	canManage: boolean;
	onChanged: () => void | Promise<void>;
}

/** One pending invitation sent by the household. */
export function SentInvitationItem({
	householdId,
	invitation,
	canManage,
	onChanged,
}: SentInvitationItemProps) {
	const { email } = invitation;
	const onError = (error: unknown) => {
		toast.error(actionErrorMessage(error));
	};
	// Inviting the same email again renews the invitation and emails it again
	const resend = useMutation({
		mutationFn: () =>
			getApi().households.invitations.create(householdId, { email }),
		onSuccess: async () => {
			toast.success(m.toast_invitation_sent({ email }));
			await onChanged();
		},
		onError,
	});
	const cancel = useMutation({
		mutationFn: () =>
			getApi().households.invitations.remove(householdId, invitation.id),
		onSuccess: onChanged,
		onError,
	});
	const isPending = resend.isPending || cancel.isPending;

	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<div className="grid min-w-40 flex-1 gap-0.5">
				<p className="break-all font-medium">{email}</p>
				<p className="text-muted-foreground text-sm">
					{m.invitation_sent_by({ inviter: invitation.invitedByName })}
				</p>
			</div>
			{canManage && (
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label={m.invitation_resend_label({ email })}
						disabled={isPending}
						onClick={() => resend.mutate()}
					>
						{m.invitation_resend_button()}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label={m.invitation_cancel_label({ email })}
						disabled={isPending}
						onClick={() => cancel.mutate()}
					>
						{m.invitation_cancel_button()}
					</Button>
				</div>
			)}
		</li>
	);
}
