import type { Account, Household } from "@repo/schemas";
import { toast } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2Icon } from "lucide-react";
import { useId } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { importsQueryOptions } from "@/features/imports/imports-query";
import { getApi } from "@/lib/api";
import { formatShortDay } from "@/lib/dates";
import { actionErrorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface ImportHistoryProps {
	household: Household;
	accounts: Account[];
}

/** The member's recent imports, each of which they can undo. */
export function ImportHistory({ household, accounts }: ImportHistoryProps) {
	const locale = getLocale();
	const titleId = useId();
	const queryClient = useQueryClient();
	const { data } = useQuery(importsQueryOptions(household.id));
	const undo = useMutation({
		mutationFn: (importId: string) =>
			getApi().imports.remove(household.id, importId),
		onSuccess: () => {
			toast.success(m.toast_import_undone());
			queryClient.invalidateQueries({ queryKey: ["households", household.id] });
		},
		onError: (error) => toast.error(actionErrorMessage(error)),
	});
	if (!data || data.items.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3 border-border border-t pt-6"
		>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.import_history_title()}
			</h2>
			<ul className="grid gap-3">
				{data.items.map((each) => (
					<li
						key={each.id}
						className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3"
					>
						<div className="grid gap-1">
							<p className="font-medium">
								{m.import_history_item({
									date: formatShortDay(each.createdAt.slice(0, 10), locale),
								})}
							</p>
							{each.accounts.map((counts) => (
								<p
									key={counts.accountId}
									className="text-muted-foreground text-sm"
								>
									{
										accounts.find((account) => account.id === counts.accountId)
											?.name
									}
									{" · "}
									{m.import_done_counts({
										created: counts.created,
										linked: counts.linked,
										confirmed: counts.confirmed,
									})}
								</p>
							))}
						</div>
						<ConfirmButton
							label={m.import_undo()}
							icon={Undo2Icon}
							ariaLabel={m.import_undo_aria({
								date: formatShortDay(each.createdAt.slice(0, 10), locale),
							})}
							title={m.import_undo_title()}
							description={m.import_undo_description()}
							confirmLabel={m.import_undo()}
							pending={undo.isPending && undo.variables === each.id}
							onConfirm={() => undo.mutate(each.id)}
						/>
					</li>
				))}
			</ul>
		</section>
	);
}
