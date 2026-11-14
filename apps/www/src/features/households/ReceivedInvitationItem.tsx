import { NotFoundError } from "@repo/resources";
import type { Household, ReceivedInvitation } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { FormAlert } from "@/components/FormAlert";
import { getApi } from "@/lib/api";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface ReceivedInvitationItemProps {
	invitation: ReceivedInvitation;
	onAccepted: (household: Household) => void | Promise<void>;
	onDeclined: () => void | Promise<void>;
}

/** An invitation that expired or was cancelled meanwhile has its own message. */
function invitationError(error: unknown): string | undefined {
	if (!error) {
		return undefined;
	}
	return error instanceof NotFoundError
		? m.error_invitation_not_found()
		: formErrors(error).form;
}

/** One invitation to join a household, to accept or decline. */
export function ReceivedInvitationItem({
	invitation,
	onAccepted,
	onDeclined,
}: ReceivedInvitationItemProps) {
	const accept = useMutation({
		mutationFn: () => getApi().invitations.accept(invitation.id),
		onSuccess: onAccepted,
	});
	const decline = useMutation({
		mutationFn: () => getApi().invitations.decline(invitation.id),
		onSuccess: onDeclined,
	});
	const isPending = accept.isPending || decline.isPending;

	return (
		<li className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
			<p>
				{m.invitation_text({
					inviter: invitation.invitedByName,
					household: invitation.household.name,
				})}
			</p>
			<FormAlert message={invitationError(accept.error ?? decline.error)} />
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					disabled={isPending}
					onClick={() => accept.mutate()}
				>
					{m.invitation_accept_button()}
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={isPending}
					onClick={() => decline.mutate()}
				>
					{m.invitation_decline_button()}
				</Button>
			</div>
		</li>
	);
}
