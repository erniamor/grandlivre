import type { Household, ReceivedInvitation } from "@repo/schemas";
import { useId } from "react";
import { ReceivedInvitationItem } from "@/features/households/ReceivedInvitationItem";
import { m } from "@/paraglide/messages";

interface ReceivedInvitationsProps {
	invitations: ReceivedInvitation[];
	onAccepted: (household: Household) => void | Promise<void>;
	onDeclined: () => void | Promise<void>;
}

/** The invitations to join a household received by the signed-in user. */
export function ReceivedInvitations({
	invitations,
	onAccepted,
	onDeclined,
}: ReceivedInvitationsProps) {
	const titleId = useId();

	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.invitations_title()}
			</h2>
			<ul className="grid gap-3">
				{invitations.map((invitation) => (
					<ReceivedInvitationItem
						key={invitation.id}
						invitation={invitation}
						onAccepted={onAccepted}
						onDeclined={onDeclined}
					/>
				))}
			</ul>
		</section>
	);
}
