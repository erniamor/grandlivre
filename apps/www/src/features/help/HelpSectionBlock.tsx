import type { HelpSection } from "@/features/help/help-sections";

interface HelpSectionBlockProps {
	section: HelpSection;
}

/** A section of the help page, reached by its anchor. */
export function HelpSectionBlock({ section }: HelpSectionBlockProps) {
	const titleId = `${section.id}-title`;

	return (
		<section
			id={section.id}
			aria-labelledby={titleId}
			className="grid scroll-mt-20 gap-3"
		>
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{section.title()}
			</h2>
			{/* A section's paragraphs never move: their place tells them apart */}
			{section.paragraphs.map((paragraph, index) => (
				<p key={`${section.id}-${index}`} className="max-w-prose">
					{paragraph()}
				</p>
			))}
		</section>
	);
}
