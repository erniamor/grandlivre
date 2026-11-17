import type { Household } from "@repo/schemas";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { CreateHouseholdForm } from "@/features/households/CreateHouseholdForm";
import { ReceivedInvitations } from "@/features/households/ReceivedInvitations";
import {
	receivedInvitationsQueryKey,
	receivedInvitationsQueryOptions,
} from "@/features/households/received-invitations-query";
import { m } from "@/paraglide/messages";

interface SetupPageProps {
	/** The user already has a household: this one is another. */
	another?: boolean;
	/** Called once in a household: one the user made, or one they joined. */
	onReady: (
		household: Household,
		how: "created" | "joined",
	) => void | Promise<void>;
}

/**
 * Join a household the user was invited to, or create their own: the
 * first one, or another.
 */
export function SetupPage({ another = false, onReady }: SetupPageProps) {
	const queryClient = useQueryClient();
	const { data: invitations } = useSuspenseQuery(
		receivedInvitationsQueryOptions(),
	);
	const createTitleId = useId();

	return (
		<section className="mx-auto grid max-w-md gap-8 px-4 py-12">
			<header className="grid gap-2">
				{another && (
					<Link
						to="/dashboard"
						className="justify-self-start text-muted-foreground text-sm underline-offset-4 hover:underline"
					>
						{m.setup_back()}
					</Link>
				)}
				<h1 className="font-heading font-semibold text-2xl">
					{another ? m.setup_another_title() : m.setup_title()}
				</h1>
				<p className="text-muted-foreground">
					{another ? m.setup_another_intro() : m.setup_intro()}
				</p>
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
