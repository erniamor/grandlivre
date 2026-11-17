import { Button, Input } from "@repo/ui";
import { SearchIcon } from "lucide-react";
import { useId } from "react";
import { HelpHint } from "@/features/help/HelpHint";
import { LINE_FILTERS, type LineFilter } from "@/features/imports/line-filters";
import { m } from "@/paraglide/messages";

interface LineFilterBarProps {
	counts: Record<LineFilter, number>;
	filter: LineFilter;
	onFilter: (filter: LineFilter) => void;
	search: string;
	onSearch: (search: string) => void;
}

const labels: Record<LineFilter, () => string> = {
	fresh: m.import_filter_fresh,
	known: m.import_filter_known,
	recurring: m.import_filter_recurring,
	imported: m.import_filter_imported,
};

/**
 * Which of an account's lines show: one filter at a time, each with how
 * many lines it holds (the empty ones left out), and a search by payee.
 */
export function LineFilterBar({
	counts,
	filter,
	onFilter,
	search,
	onSearch,
}: LineFilterBarProps) {
	const searchId = useId();

	return (
		<div className="flex flex-wrap items-center gap-2">
			<fieldset className="flex flex-wrap items-center gap-1">
				<legend className="sr-only">{m.import_filters_label()}</legend>
				{LINE_FILTERS.filter((each) => counts[each] > 0 || each === filter).map(
					(each) => (
						<Button
							key={each}
							type="button"
							size="sm"
							variant={each === filter ? "default" : "outline"}
							aria-pressed={each === filter}
							onClick={() => onFilter(each)}
						>
							{labels[each]()} ({counts[each]})
						</Button>
					),
				)}
				{counts.known > 0 && <HelpHint topic="importKnown" />}
			</fieldset>
			<div className="relative min-w-40 flex-1">
				<label htmlFor={searchId} className="sr-only">
					{m.import_search_label()}
				</label>
				<SearchIcon
					aria-hidden
					className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
				/>
				<Input
					id={searchId}
					type="search"
					value={search}
					placeholder={m.import_search_placeholder()}
					className="pl-8"
					onChange={(event) => onSearch(event.target.value)}
				/>
			</div>
		</div>
	);
}
