import type { Household } from "@repo/schemas";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useId } from "react";
import { CreateHouseholdForm } from "@/features/households/CreateHouseholdForm";
import { ReceivedInvitations } from "@/features/households/ReceivedInvitations";
import {
	receivedInvitationsQueryKey,
	receivedInvitationsQueryOptions,
} from "@/features/households/received-invitations-query";
import { m } from "@/paraglide/messages";

interface SetupPageProps {
	/** Called once in a household: one the user made, or one they joined. */
	onReady: (
		household: Household,
		how: "created" | "joined",
	) => void | Promise<void>;
}

/**
 * For a signed-in user without a household: join one they were invited to,
 * or create their own.
 */
export function SetupPage({ onReady }: SetupPageProps) {
	const queryClient = useQueryClient();
	const { data: invitations } = useSuspenseQuery(
		receivedInvitationsQueryOptions(),
	);
	const createTitleId = useId();

	return (
		<section className="mx-auto grid max-w-md gap-8 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.setup_title()}
				</h1>
				<p className="text-muted-foreground">{m.setup_intro()}</p>
			</header>
			{invitations.items.length > 0 && (
				<ReceivedInvitations
					invitations={invitations.items}
					onAccepted={(household) => onReady(household, "joined")}
					onDeclined={() =>
						queryClient.invalidateQueries({
							queryKey: receivedInvitationsQueryKey,
						})
					}
				/>
			)}
			<section aria-labelledby={createTitleId} className="grid gap-3">
				<h2 id={createTitleId} className="font-heading font-semibold text-lg">
					{m.create_household_title()}
				</h2>
				<CreateHouseholdForm
					onCreated={(household) => onReady(household, "created")}
				/>
			</section>
		</section>
	);
}
