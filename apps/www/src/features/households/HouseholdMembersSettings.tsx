import type { Household, Profile } from "@repo/schemas";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
	householdInvitationsQueryKey,
	householdInvitationsQueryOptions,
} from "@/features/households/household-invitations-query";
import {
	householdMembersQueryKey,
	householdMembersQueryOptions,
} from "@/features/households/household-members-query";
import { MemberList } from "@/features/households/MemberList";
import { SentInvitations } from "@/features/households/SentInvitations";

interface HouseholdMembersSettingsProps {
	me: Profile;
	household: Household;
	/**
	 * Called when the signed-in user's own membership changed: their role, or
	 * `left` when they left the household.
	 */
	onMembershipChanged: (left: boolean) => void | Promise<void>;
}

/** The household's members, and the invitations sent to join it. */
export function HouseholdMembersSettings({
	me,
	household,
	onMembershipChanged,
}: HouseholdMembersSettingsProps) {
	const queryClient = useQueryClient();
	const { data: members } = useSuspenseQuery(
		householdMembersQueryOptions(household.id),
	);
	const { data: invitations } = useSuspenseQuery(
		householdInvitationsQueryOptions(household.id),
	);

	return (
		<>
			<MemberList
				household={household}
				members={members.items}
				meId={me.id}
				onChanged={async ({ self, left }) => {
					if (self) {
						await onMembershipChanged(left);
					}
					if (!left) {
						await queryClient.invalidateQueries({
							queryKey: householdMembersQueryKey(household.id),
						});
					}
				}}
			/>
			<SentInvitations
				household={household}
				invitations={invitations.items}
				onChanged={() =>
					queryClient.invalidateQueries({
						queryKey: householdInvitationsQueryKey(household.id),
					})
				}
			/>
		</>
	);
}
