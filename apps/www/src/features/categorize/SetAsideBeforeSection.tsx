import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TextField } from "@/components/TextField";
import { uncategorizedCountQueryOptions } from "@/features/categorize/uncategorized-query";
import { useSetAside } from "@/features/categorize/use-set-aside";
import { formatDay } from "@/lib/dates";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface SetAsideBeforeSectionProps {
	householdId: string;
}

/**
 * Sets aside as undetermined every transaction without a tag before a day,
 * on the user's accounts: a past too old to categorize. How many is told
 * as the day is chosen, then confirmed.
 */
export function SetAsideBeforeSection({
	householdId,
}: SetAsideBeforeSectionProps) {
	const titleId = useId();
	const [before, setBefore] = useState("");
	const counted = useQuery({
		...uncategorizedCountQueryOptions(householdId, before),
		enabled: before !== "",
	});
	const count = before === "" ? undefined : counted.data?.count;
	const { setAside, pending } = useSetAside(householdId, (done) =>
		m.toast_set_aside_before({ count: done }),
	);

	return (
		<section
			aria-labelledby={titleId}
			className="grid gap-3 rounded-lg border border-border p-4"
		>
			<h2 id={titleId} className="font-medium">
				{m.categorize_before_title()}
			</h2>
			<p className="text-muted-foreground text-sm">
				{m.categorize_before_intro()}
			</p>
			<TextField
				label={m.categorize_before_label()}
				type="date"
				value={before}
				onChange={(event) => setBefore(event.target.value)}
				className="sm:w-60"
			/>
			<p aria-live="polite" className="text-sm empty:hidden">
				{count !== undefined && m.categorize_before_count({ count })}
			</p>
			{count !== undefined && count > 0 && (
				<div>
					<ConfirmButton
						label={m.categorize_before_button()}
						title={m.categorize_before_confirm_title()}
						description={m.categorize_before_confirm_text({
							count,
							day: formatDay(before, getLocale()),
						})}
						confirmLabel={m.categorize_before_button()}
						pending={pending}
						onConfirm={() => {
							setAside({ by: "before", date: before });
							setBefore("");
						}}
					/>
				</div>
			)}
		</section>
	);
}
