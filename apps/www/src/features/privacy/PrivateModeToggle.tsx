import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { headerButtonClass } from "@/components/header-styles";
import { WithTooltip } from "@/components/WithTooltip";
import { applyPrivateMode } from "@/features/privacy/private-mode";
import { m } from "@/paraglide/messages";

interface PrivateModeToggleProps {
	/** Whether the private mode was on when the page was rendered. */
	initialPrivate: boolean;
}

/**
 * Hides what is sensitive on screen, to show the app to someone, or shows
 * it again: an eye in the header, crossed out and labelled while it hides.
 */
export function PrivateModeToggle({ initialPrivate }: PrivateModeToggleProps) {
	const [on, setOn] = useState(initialPrivate);
	const Icon = on ? EyeOffIcon : EyeIcon;

	return (
		<WithTooltip label={on ? m.private_mode_off() : m.private_mode_on()}>
			<button
				type="button"
				aria-pressed={on}
				aria-label={m.private_mode_label()}
				className={headerButtonClass}
				onClick={() => {
					applyPrivateMode(!on);
					setOn(!on);
				}}
			>
				<Icon aria-hidden className="size-5" />
				{on && (
					<span className="font-medium text-xs">{m.private_mode_badge()}</span>
				)}
			</button>
		</WithTooltip>
	);
}
