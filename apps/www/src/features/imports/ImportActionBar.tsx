import { Button } from "@repo/ui";
import { ArrowUpIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

interface ImportActionBarProps {
	/** The transactions the import adds. */
	newTransactions: number;
	/** Some choices are missing: offers to go to the first one. */
	corrections: boolean;
	onCorrection: () => void;
	/** The file couldn't be imported: offers to read it again. */
	failed: boolean;
	onReadAgain: () => void;
	onOtherFile: () => void;
	saving: boolean;
	disabled: boolean;
	onSubmit: () => void;
}

/**
 * The review's actions, kept in sight at the bottom of the screen however
 * long the file: what the import adds, the way to the first correction,
 * and the import itself.
 */
export function ImportActionBar({
	newTransactions,
	corrections,
	onCorrection,
	failed,
	onReadAgain,
	onOtherFile,
	saving,
	disabled,
	onSubmit,
}: ImportActionBarProps) {
	return (
		<div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-border border-t bg-background/95 px-4 py-3 backdrop-blur">
			<p className="font-medium text-sm">
				{m.import_bar_count({ count: newTransactions })}
			</p>
			<div className="flex flex-wrap gap-2">
				{corrections && (
					<Button type="button" variant="outline" onClick={onCorrection}>
						<ArrowUpIcon aria-hidden />
						{m.import_go_to_correction()}
					</Button>
				)}
				<Button type="button" variant="outline" onClick={onOtherFile}>
					{m.import_other_file()}
				</Button>
				{failed && (
					<Button type="button" variant="outline" onClick={onReadAgain}>
						{m.import_read_again()}
					</Button>
				)}
				<Button type="button" disabled={disabled} onClick={onSubmit}>
					{saving ? m.import_saving() : m.import_submit()}
				</Button>
			</div>
		</div>
	);
}
