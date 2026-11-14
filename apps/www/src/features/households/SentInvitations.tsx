import type { Household, HouseholdInvitation } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useId } from "react";
import { InviteForm } from "@/features/households/InviteForm";
import { SentInvitationItem } from "@/features/households/SentInvitationItem";
import { m } from "@/paraglide/messages";

interface SentInvitationsProps {
	household: Household;
	invitations: HouseholdInvitation[];
	onChanged: () => void | Promise<void>;
}

/** The household's pending invitations; owners invite and manage them. */
export function SentInvitations({
	household,
	invitations,
	onChanged,
}: SentInvitationsProps) {
	const titleId = useId();
	const isOwner = household.role === "owner";

	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.invitations_title()}
			</h2>
			{invitations.length === 0 ? (
				<p className="text-muted-foreground">{m.invitations_empty()}</p>
			) : (
				<ul className="grid gap-3">
					{invitations.map((invitation) => (
						<SentInvitationItem
							key={invitation.id}
							householdId={household.id}
							invitation={invitation}
							canManage={isOwner}
							onChanged={onChanged}
						/>
					))}
				</ul>
			)}
			{isOwner && (
				<InviteForm
					householdId={household.id}
					onInvited={async (invitation) => {
						toast.success(m.toast_invitation_sent({ email: invitation.email }));
						await onChanged();
					}}
				/>
			)}
		</section>
	);
}
