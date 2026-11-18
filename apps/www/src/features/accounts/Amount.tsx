import { cn } from "@repo/ui";
import { sensitiveClass } from "@/components/sensitive";
import { formatAmount } from "@/lib/money";
import { getLocale } from "@/paraglide/runtime";

interface AmountProps {
	/** In minor units of `currency` (cents). */
	amount: number;
	currency: string;
	className?: string;
}

/** An amount of money, aligned on its digits; money owed stands out. */
export function Amount({ amount, currency, className }: AmountProps) {
	return (
		<span
			className={cn(
				sensitiveClass,
				"whitespace-nowrap tabular-nums",
				amount < 0 && "text-destructive",
				className,
			)}
		>
			{formatAmount(amount, currency, getLocale())}
		</span>
	);
}
