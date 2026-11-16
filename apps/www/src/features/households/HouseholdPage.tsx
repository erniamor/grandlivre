import type { Household, Profile } from "@repo/schemas";
import { buttonVariants } from "@repo/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListChecksIcon } from "lucide-react";
import { HouseholdCurrencyField } from "@/features/households/HouseholdCurrencyField";
import { HouseholdNameField } from "@/features/households/HouseholdNameField";
import { HouseholdSharingField } from "@/features/households/HouseholdSharingField";
import { HouseholdTimeZoneField } from "@/features/households/HouseholdTimeZoneField";
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
import { m } from "@/paraglide/messages";

interface HouseholdPageProps {
	me: Profile;
	household: Household;
	/**
	 * Called when the signed-in user's own membership changed: their role, or
	 * `left` when they left the household.
	 */
	onMembershipChanged: (left: boolean) => void | Promise<void>;
}

/**
 * The household's settings: its name, its currency, its time zone, its
 * members and invitations.
 */
export function HouseholdPage({
	me,
	household,
	onMembershipChanged,
}: HouseholdPageProps) {
	const queryClient = useQueryClient();
	const { data: members } = useSuspenseQuery(
		householdMembersQueryOptions(household.id),
	);
	const { data: invitations } = useSuspenseQuery(
		householdInvitationsQueryOptions(household.id),
	);

	return (
		<section className="mx-auto grid max-w-2xl gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.household_title()}
				</h1>
				<p className="text-muted-foreground">{m.household_intro()}</p>
				<Link
					to="/getting-started"
					className={buttonVariants({
						variant: "outline",
						className: "justify-self-start",
					})}
				>
					<ListChecksIcon aria-hidden />
					{m.getting_started_link()}
				</Link>
			</header>
			<div className="grid gap-4">
				<HouseholdNameField household={household} />
				<HouseholdCurrencyField household={household} />
				<HouseholdTimeZoneField household={household} />
				<HouseholdSharingField household={household} />
			</div>
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
		</section>
	);
}
