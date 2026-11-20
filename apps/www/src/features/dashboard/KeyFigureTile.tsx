import { cn } from "@repo/ui";
import type { ReactNode } from "react";
import { cardClass } from "@/components/card-styles";

interface KeyFigureTileProps {
	label: string;
	/** The figure, large. */
	value: ReactNode;
	/** A line under it: what it compares with, what it is made of. */
	detail?: ReactNode;
	/** A link to where it comes from. */
	link?: ReactNode;
	className?: string;
}

/** One of the dashboard's key figures: its name, the figure, a line under it. */
export function KeyFigureTile({
	label,
	value,
	detail,
	link,
	className,
}: KeyFigureTileProps) {
	return (
		<div
			className={cn("grid min-w-0 content-start gap-1", cardClass, className)}
		>
			<dt className="text-muted-foreground text-sm">{label}</dt>
			<dd className="break-words font-heading font-semibold text-xl sm:text-2xl">
				{value}
			</dd>
			{detail && <dd className="text-muted-foreground text-sm">{detail}</dd>}
			{link && <dd className="text-sm">{link}</dd>}
		</div>
	);
}
