import { Button } from "@repo/ui";
import { FlaskConicalIcon } from "lucide-react";
import { useId } from "react";
import { useDemoHousehold } from "@/features/households/use-demo-household";
import { m } from "@/paraglide/messages";

/** Makes a demo household of made-up data, to try the app without one's own. */
export function TryDemoSection() {
	const titleId = useId();
	const demo = useDemoHousehold();

	return (
		<section aria-labelledby={titleId} className="grid gap-3">
			<h2 id={titleId} className="font-heading font-semibold text-lg">
				{m.demo_try_title()}
			</h2>
			<p className="text-muted-foreground text-sm">{m.demo_try_text()}</p>
			<Button
				type="button"
				variant="outline"
				className="justify-self-start"
				disabled={demo.creating}
				onClick={() => demo.create()}
			>
				<FlaskConicalIcon aria-hidden />
				{demo.creating ? m.demo_creating() : m.demo_try_button()}
			</Button>
		</section>
	);
}
