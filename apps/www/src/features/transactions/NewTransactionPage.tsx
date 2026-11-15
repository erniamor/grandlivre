import type { Household, ProposedTag, UpdateTransaction } from "@repo/schemas";
import { buttonVariants, toast } from "@repo/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { accountsQueryOptions } from "@/features/accounts/accounts-query";
import { tagsQueryKey, tagsQueryOptions } from "@/features/tags/tags-query";
import { AssistantNotes } from "@/features/transactions/AssistantNotes";
import { rememberLastAccount } from "@/features/transactions/last-account";
import {
	useDraftPhoto,
	useNoteDraft,
	useOpenDraft,
} from "@/features/transactions/note-draft";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { ReceiptDetails } from "@/features/transactions/ReceiptDetails";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { TransactionsBackLink } from "@/features/transactions/TransactionsBackLink";
import {
	withCreatedTag,
	withOrigin,
	writableAccounts,
} from "@/features/transactions/transaction-form";
import { useTransactionChange } from "@/features/transactions/use-transaction-change";
import { getApi } from "@/lib/api";
import { m } from "@/paraglide/messages";

interface NewTransactionPageProps {
	household: Household;
	/** The account proposed, e.g. the one the list was filtered on. */
	accountId?: string;
	/** The id of a draft of the assistant to review, if the form starts from one. */
	draftId?: string;
	/** Called once the transaction is recorded. */
	onCreated: () => void | Promise<void>;
}

/**
 * Records a transaction on an account the signed-in user holds: typed in
 * the form, or described in a note or scanned from a receipt, which the
 * assistant turns into a draft.
 */
export function NewTransactionPage({
	household,
	accountId,
	draftId,
	onCreated,
}: NewTransactionPageProps) {
	const queryClient = useQueryClient();
	const { data: accounts } = useSuspenseQuery(
		accountsQueryOptions(household.id),
	);
	const { data: tags } = useSuspenseQuery(tagsQueryOptions(household.id));
	const refresh = useTransactionChange(household.id);
	const draft = useNoteDraft(draftId);
	const photo = useDraftPhoto(draftId);
	const openDraft = useOpenDraft();
	// The tag created for this draft: a retry after a failure doesn't create it twice
	const createdTag = useRef<string>(undefined);

	const save = async (
		input: UpdateTransaction,
		proposedTag: ProposedTag | null,
	) => {
		let transaction = input;
		if (proposedTag) {
			createdTag.current ??= (
				await getApi().tags.create(household.id, {
					names: proposedTag.names,
					parentId: proposedTag.parentId,
				})
			).id;
			transaction = withCreatedTag(input, createdTag.current);
		}
		return getApi().transactions.create(
			household.id,
			withOrigin(transaction, draft),
		);
	};

	return (
		<section className="mx-auto grid max-w-md gap-6 px-4 py-12">
			<TransactionsBackLink />
			<h1 className="font-heading font-semibold text-2xl">
				{m.transaction_new_title()}
			</h1>
			{writableAccounts(accounts.items).length === 0 ? (
				// Transactions are recorded on an account the user holds
				<div className="grid gap-4">
					<p className="text-muted-foreground">{m.transaction_no_account()}</p>
					<Link
						to="/accounts/new"
						className={`${buttonVariants()} justify-self-start`}
					>
						{m.account_add_button()}
					</Link>
				</div>
			) : (
				<>
					<QuickEntry
						householdId={household.id}
						onDraft={(next, photo) => openDraft(next, { replace: true, photo })}
					/>
					{draft && <AssistantNotes draft={draft} />}
					{draft?.receipt && (
						<ReceiptDetails
							receipt={draft.receipt}
							photo={photo}
							currency={household.currency}
						/>
					)}
					{/* A new draft starts a fresh form: the key follows it */}
					<TransactionForm
						key={draftId ?? "blank"}
						currency={household.currency}
						accounts={accounts.items}
						tags={tags}
						draft={draft}
						defaultAccountId={draft?.accountId ?? accountId}
						submitLabel={m.transaction_create_button()}
						save={save}
						onSaved={async (transaction) => {
							rememberLastAccount(transaction.accountId);
							await Promise.all([
								refresh(),
								createdTag.current
									? queryClient.invalidateQueries({
											queryKey: tagsQueryKey(household.id),
										})
									: undefined,
							]);
							toast.success(m.toast_transaction_created());
							await onCreated();
						}}
					/>
				</>
			)}
		</section>
	);
}
