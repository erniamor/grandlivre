import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { helpSections } from "@/features/help/help-sections";
import { m } from "@/paraglide/messages";

/** The sections of the help page, each a link to its place. */
export function HelpContents() {
	const titleId = useId();

	return (
		<nav aria-labelledby={titleId} className="grid gap-2">
			<h2 id={titleId} className="font-medium text-sm">
				{m.help_contents()}
			</h2>
			<ul className="grid gap-1 text-sm sm:grid-cols-2">
				{helpSections.map((section) => (
					<li key={section.id}>
						<Link
							to="/help"
							hash={section.id}
							className="underline-offset-4 hover:underline"
						>
							{section.title()}
						</Link>
					</li>
				))}
				<li>
					<Link
						to="/help"
						hash="faq"
						className="underline-offset-4 hover:underline"
					>
						{m.help_faq_title()}
					</Link>
				</li>
			</ul>
		</nav>
	);
}
