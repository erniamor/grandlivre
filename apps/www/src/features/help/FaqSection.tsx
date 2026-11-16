import { Input, Label } from "@repo/ui";
import { useId, useState } from "react";
import { faq, searchFaq } from "@/features/help/faq";
import { m } from "@/paraglide/messages";

/** The questions asked often, each opened on demand, and a search among them. */
export function FaqSection() {
	const titleId = useId();
	const searchId = useId();
	const [search, setSearch] = useState("");
	const found = searchFaq(faq, search);

	return (
		<section
			id="faq"
			aria-labelledby={titleId}
			className="grid scroll-mt-20 gap-3"
		>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.help_faq_title()}
			</h2>
			<div className="grid gap-2">
				<Label htmlFor={searchId}>{m.help_faq_search_label()}</Label>
				<Input
					id={searchId}
					type="search"
					value={search}
					onChange={(event) => setSearch(event.currentTarget.value)}
				/>
			</div>
			{/* Announces how many questions the search leaves */}
			<p aria-live="polite" className="text-muted-foreground text-sm">
				{found.length === 0
					? m.help_faq_none()
					: m.help_faq_count({ count: found.length })}
			</p>
			<ul className="grid gap-2">
				{found.map((item) => (
					<li key={item.question()}>
						<details className="rounded-lg border border-border p-3">
							<summary className="cursor-pointer font-medium">
								{item.question()}
							</summary>
							<p className="mt-2 max-w-prose text-muted-foreground">
								{item.answer()}
							</p>
						</details>
					</li>
				))}
			</ul>
		</section>
	);
}
