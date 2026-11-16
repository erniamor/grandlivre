import type { StatementPreviewLine } from "@repo/schemas";
import {
	ArrowLeftRightIcon,
	CheckCheckIcon,
	CheckIcon,
	type LucideIcon,
	RepeatIcon,
} from "lucide-react";
import { m } from "@/paraglide/messages";

interface LineStatusBadgeProps {
	status: StatementPreviewLine["status"];
	/** For a transfer's other side: the account it is entered in. */
	accountName: string | null;
}

/**
 * What a line already is in the app, in words and an icon, never by its
 * color alone; nothing for a new line.
 */
export function LineStatusBadge({ status, accountName }: LineStatusBadgeProps) {
	const badges: Partial<
		Record<StatementPreviewLine["status"], { icon: LucideIcon; label: string }>
	> = {
		imported: { icon: CheckIcon, label: m.import_status_imported() },
		matched: { icon: CheckCheckIcon, label: m.import_status_matched() },
		counterpart: {
			icon: ArrowLeftRightIcon,
			label: m.import_status_counterpart({ account: accountName ?? "" }),
		},
		recurring: { icon: RepeatIcon, label: m.import_status_recurring() },
	};
	const badge = badges[status];
	if (!badge) {
		return null;
	}
	const { icon: Icon, label } = badge;

	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 font-medium text-xs">
			<Icon aria-hidden className="size-3" />
			{label}
		</span>
	);
}
