import { Input } from "@repo/ui";
import { SearchIcon } from "lucide-react";
import { useId, useState } from "react";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { m } from "@/paraglide/messages";

/** How long typing pauses before the list follows. */
export const SEARCH_DELAY = 300;

interface TransactionSearchFieldProps {
	/** The words searched now, from the address. */
	value?: string;
	/** Called once typing pauses, with the words trimmed, undefined when none. */
	onSearch: (q: string | undefined) => void;
}

/** A search through the transactions' payees, notes and receipts. */
export function TransactionSearchField({
	value = "",
	onSearch,
}: TransactionSearchFieldProps) {
	const id = useId();
	// What is typed, the search in the address it was typed over, and the
	// one sent, on its way to the address: a search changed elsewhere
	// (cleared, the browser's back) replaces what is typed
	const [typed, setTyped] = useState<{
		text: string;
		base: string;
		sent?: string;
	}>({ text: value, base: value });
	if (typed.base !== value) {
		setTyped(
			value === typed.sent
				? { text: typed.text, base: value }
				: { text: value, base: value },
		);
	}
	const search = useDebouncedCallback((text: string) => {
		const trimmed = text.trim();
		if (trimmed !== value) {
			setTyped((current) => ({ ...current, sent: trimmed }));
			onSearch(trimmed || undefined);
		}
	}, SEARCH_DELAY);

	return (
		<div className="grid gap-2">
			<label htmlFor={id} className="font-medium text-sm">
				{m.transactions_search_label()}
			</label>
			<div className="relative">
				<SearchIcon
					aria-hidden
					className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
				/>
				<Input
					id={id}
					type="search"
					value={typed.text}
					placeholder={m.transactions_search_placeholder()}
					className="pl-8"
					onChange={(event) => {
						setTyped({ ...typed, text: event.target.value });
						search(event.target.value);
					}}
				/>
			</div>
		</div>
	);
}
