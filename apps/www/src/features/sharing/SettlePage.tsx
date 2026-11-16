import type { Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { SettleForm } from "@/features/sharing/SettleForm";
import { sharingOverviewQueryOptions } from "@/features/sharing/sharing-query";
import { useSharingChange } from "@/features/sharing/use-sharing-change";
import { useLocalToday } from "@/features/transactions/use-local-today";
import { useTransactionChange } from "@/features/transactions/use-transaction-change";
import { formatAmountInput } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SettlePageProps {
	household: Household;
	meId: string;
	/** The payment proposed: who pays whom, how much. */
	proposed: { from?: string; to?: string; amount?: number };
	onSettled: () => void | Promise<void>;
}

/** Records a payment that settles what a member owes another. */
export function SettlePage({
	household,
	meId,
	proposed,
	onSettled,
}: SettlePageProps) {
	const { data: overview } = useSuspenseQuery(
		sharingOverviewQueryOptions(household.id),
	);
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const refreshSharing = useSharingChange(household.id);
	const refreshTransactions = useTransactionChange(household.id);
	const today = useLocalToday();
	const members = overview.balances
		.filter((balance) => balance.isMember)
		.map(({ userId, name }) => ({ userId, name }));
	const isMember = (id: string | undefined) =>
		members.some((member) => member.userId === id);

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<Link
				to="/shared"
				className="inline-flex items-center gap-1.5 justify-self-start rounded-sm text-muted-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
			>
				<ArrowLeftIcon aria-hidden className="size-4" />
				{m.sharing_back_link()}
			</Link>
			<h1 className="font-heading font-semibold text-2xl">
				{m.settle_title()}
			</h1>
			<SettleForm
				householdId={household.id}
				currency={household.currency}
				meId={meId}
				members={members}
				accounts={accounts.items}
				initial={{
					fromUserId: isMember(proposed.from) ? (proposed.from ?? meId) : meId,
					toUserId: isMember(proposed.to)
						? (proposed.to ?? "")
						: (members.find((member) => member.userId !== meId)?.userId ?? ""),
					amount:
						proposed.amount !== undefined
							? formatAmountInput(
									proposed.amount,
									household.currency,
									getLocale(),
								)
							: "",
					date: today,
					note: "",
					transfer: false,
					fromAccountId: "",
					toAccountId: "",
				}}
				onSettled={async () => {
					await Promise.all([refreshSharing(), refreshTransactions()]);
					toast.success(m.toast_settlement_recorded());
					await onSettled();
				}}
			/>
		</section>
	);
}
