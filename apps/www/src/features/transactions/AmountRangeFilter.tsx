import { Slider } from "@repo/ui";
import { useId, useState } from "react";
import {
	type AmountRange,
	NO_MAXIMUM,
	rangeToStops,
	stopAmount,
	stopsToRange,
} from "@/features/transactions/amount-stops";
import { formatAmountCompact } from "@/lib/money";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface AmountRangeFilterProps {
	range: AmountRange;
	currency: string;
	/** Called once a thumb is let go, or moved by the keyboard. */
	onChange: (range: AmountRange) => void;
}

/** The transactions' total between two amounts, chosen on a slider of stops. */
export function AmountRangeFilter({
	range,
	currency,
	onChange,
}: AmountRangeFilterProps) {
	const labelId = useId();
	const locale = getLocale();
	const fromRange = rangeToStops(range, currency);
	const key = fromRange.join("-");
	// Where the thumbs are being moved to, until the list follows; a range
	// changed elsewhere (cleared, the browser's back) replaces it
	const [moving, setMoving] = useState<{
		stops: [number, number];
		from: string;
	}>();
	const stops = moving && moving.from === key ? moving.stops : fromRange;
	const amount = (stop: number) =>
		formatAmountCompact(stopAmount(stop, currency), currency, locale);
	const amountText = (stop: number) =>
		stop === NO_MAXIMUM ? m.transactions_amount_no_maximum() : amount(stop);
	const [low, high] = stops;
	const summary =
		low === 0 && high === NO_MAXIMUM
			? m.transactions_amount_any()
			: high === NO_MAXIMUM
				? m.transactions_amount_at_least({ min: amount(low) })
				: low === 0
					? m.transactions_amount_at_most({ max: amount(high) })
					: m.transactions_amount_between({
							min: amount(low),
							max: amount(high),
						});

	return (
		<div className="grid gap-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<span id={labelId} className="font-medium text-sm">
					{m.transactions_amount_filter_label()}
				</span>
				<output aria-live="polite" className="text-muted-foreground text-sm">
					{summary}
				</output>
			</div>
			<Slider
				aria-labelledby={labelId}
				min={0}
				max={NO_MAXIMUM}
				step={1}
				minStepsBetweenThumbs={1}
				value={stops}
				valueText={amountText}
				thumbLabels={[
					m.transactions_amount_min_label(),
					m.transactions_amount_max_label(),
				]}
				className="py-2"
				onValueChange={(value) =>
					setMoving({
						stops: [value[0] ?? 0, value[1] ?? NO_MAXIMUM],
						from: key,
					})
				}
				onValueCommit={(value) =>
					onChange(
						stopsToRange([value[0] ?? 0, value[1] ?? NO_MAXIMUM], currency),
					)
				}
			/>
		</div>
	);
}
