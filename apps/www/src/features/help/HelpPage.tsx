import { FaqSection } from "@/features/help/FaqSection";
import { HelpContents } from "@/features/help/HelpContents";
import { HelpSectionBlock } from "@/features/help/HelpSectionBlock";
import { helpSections } from "@/features/help/help-sections";
import { m } from "@/paraglide/messages";

/** How the app works, section by section, then the questions asked often. */
export function HelpPage() {
	return (
		<section className="mx-auto grid max-w-2xl gap-10 px-4 py-12">
			<header className="grid gap-2">
				<h1 className="font-heading font-semibold text-2xl">
					{m.help_title()}
				</h1>
				<p className="text-muted-foreground">{m.help_intro()}</p>
			</header>
			<HelpContents />
			{helpSections.map((section) => (
				<HelpSectionBlock key={section.id} section={section} />
			))}
			<FaqSection />
		</section>
	);
}
