import type { Locale, SuggestedTag } from "@repo/schemas";
import { Checkbox, Label } from "@repo/ui";
import { useId } from "react";

interface SuggestedTagTreeProps {
	suggestions: SuggestedTag[];
	locale: Locale;
	selected: ReadonlySet<string>;
	onToggle: (key: string, checked: boolean) => void;
	/** Accessible name of the list, for the root level. */
	label?: string;
}

/** The suggested tags as nested lists of checkboxes, named in `locale`. */
export function SuggestedTagTree({
	suggestions,
	locale,
	selected,
	onToggle,
	label,
}: SuggestedTagTreeProps) {
	const id = useId();

	return (
		<ul
			aria-label={label}
			className={
				label ? "grid gap-2" : "ml-2 grid gap-2 border-border border-l pl-4"
			}
		>
			{suggestions.map(({ key, names, children }) => {
				const checkboxId = `${id}-${key}`;
				return (
					<li key={key} className="grid gap-2">
						<div className="flex items-center gap-2">
							<Checkbox
								id={checkboxId}
								checked={selected.has(key)}
								onCheckedChange={(checked) => onToggle(key, checked === true)}
							/>
							<Label
								htmlFor={checkboxId}
								// The tags of the first level stand out as headings of their branch
								className={label ? "font-medium" : "font-normal"}
							>
								{names[locale]}
							</Label>
						</div>
						{children.length > 0 && (
							<SuggestedTagTree
								suggestions={children}
								locale={locale}
								selected={selected}
								onToggle={onToggle}
							/>
						)}
					</li>
				);
			})}
		</ul>
	);
}
