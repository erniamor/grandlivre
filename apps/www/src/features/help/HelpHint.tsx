import { Button, Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { CircleHelpIcon } from "lucide-react";
import { type HelpTopicKey, helpTopics } from "@/features/help/help-topics";

interface HelpHintProps {
	topic: HelpTopicKey;
}

/**
 * A "?" next to a notion, opening its explanation in a few words: by a
 * click or a touch, not on hover (which touch screens don't have); Escape
 * or a click elsewhere closes it.
 */
export function HelpHint({ topic }: HelpHintProps) {
	const { label, title, text } = helpTopics[topic];

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={label()}
					className="size-6 shrink-0 rounded-full text-muted-foreground"
				>
					<CircleHelpIcon aria-hidden className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="grid gap-1 text-left font-normal">
				<p className="font-medium">{title()}</p>
				<p className="text-muted-foreground">{text()}</p>
			</PopoverContent>
		</Popover>
	);
}
