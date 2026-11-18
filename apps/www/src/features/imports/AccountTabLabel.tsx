import type { StatementPreviewAccount } from "@repo/schemas";
import { TriangleAlertIcon } from "lucide-react";
import { sensitiveClass } from "@/components/sensitive";
import { m } from "@/paraglide/messages";

interface AccountTabLabelProps {
	account: StatementPreviewAccount;
	/** Where it goes; null when it goes nowhere. */
	destination: string | null;
	/** Its lines to decide. */
	fresh: number;
	/** Something is still to correct in it. */
	corrections: boolean;
}

/**
 * An account of the file, in its tab: its number's end, where it goes,
 * how many lines are to decide, and a warning while something is to
 * correct, in words for screen readers.
 */
export function AccountTabLabel({
	account,
	destination,
	fresh,
	corrections,
}: AccountTabLabelProps) {
	return (
		<>
			{corrections && (
				<>
					<TriangleAlertIcon aria-hidden className="text-destructive" />
					<span className="sr-only">{m.import_tab_corrections()}</span>
				</>
			)}
			<span className={sensitiveClass}>···{account.numberEnd}</span>
			<span className="max-w-40 truncate font-normal">
				{destination === null
					? m.import_tab_skipped()
					: m.import_tab_destination({ name: destination })}
			</span>
			{destination !== null && fresh > 0 && (
				<span className="rounded-full bg-muted px-1.5 text-muted-foreground text-xs tabular-nums">
					{fresh}
				</span>
			)}
		</>
	);
}
