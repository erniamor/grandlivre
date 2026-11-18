import {
	Button,
	Sheet,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { PencilLineIcon } from "lucide-react";
import { type ReactElement, useState } from "react";
import { useOpenDraft } from "@/features/transactions/note-draft";
import { QuickEntry } from "@/features/transactions/QuickEntry";
import { m } from "@/paraglide/messages";

interface NewTransactionSheetProps {
	householdId: string;
	/** Where the panel comes from: the bottom on a phone, the side beside the side bar. */
	side: "bottom" | "left";
	/** The button opening it. */
	children: ReactElement;
}

/**
 * Records a transaction from any page: the quick entry (a note, dictated or
 * typed, or a receipt's photo), or the full form. The panel closes when the
 * assistant's draft opens in the form, to review.
 */
export function NewTransactionSheet({
	householdId,
	side,
	children,
}: NewTransactionSheetProps) {
	const [open, setOpen] = useState(false);
	const openDraft = useOpenDraft();

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>{children}</SheetTrigger>
			<SheetContent
				side={side}
				showCloseButton={false}
				aria-describedby={undefined}
				className="gap-2 overflow-y-auto pb-[env(safe-area-inset-bottom)] data-[side=bottom]:max-h-[90svh] data-[side=bottom]:rounded-t-xl"
			>
				<SheetHeader className="pb-0">
					<SheetTitle>{m.transaction_new_title()}</SheetTitle>
				</SheetHeader>
				<div className="grid gap-3 px-4">
					<QuickEntry
						householdId={householdId}
						onDraft={(draft, photos) => {
							setOpen(false);
							return openDraft(draft, { photos });
						}}
					/>
					<SheetClose asChild>
						<Link
							to="/transactions/new"
							className="inline-flex items-center gap-2 justify-self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						>
							<PencilLineIcon aria-hidden className="size-4" />
							{m.nav_new_transaction_form()}
						</Link>
					</SheetClose>
				</div>
				<div className="p-4 pt-2">
					<SheetClose asChild>
						<Button type="button" variant="outline" className="w-full">
							{m.nav_more_close()}
						</Button>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
