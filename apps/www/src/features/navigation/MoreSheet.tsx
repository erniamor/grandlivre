import {
	Button,
	cn,
	Sheet,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import type { NavItem } from "@/features/navigation/nav-items";
import { tabClass } from "@/features/navigation/nav-styles";
import { m } from "@/paraglide/messages";

interface MoreSheetProps {
	/** The pages the tab bar has no room for. */
	items: NavItem[];
	/** The current page is one of them: the tab shows it. */
	current: boolean;
}

/** The tab bar's "More": the other pages, in a panel rising from the bottom. */
export function MoreSheet({ items, current }: MoreSheetProps) {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<button
					type="button"
					className={cn(tabClass, "w-full")}
					data-current={current ? "" : undefined}
				>
					<EllipsisIcon aria-hidden className="size-5" />
					<span className="max-w-full truncate">{m.nav_more()}</span>
				</button>
			</SheetTrigger>
			<SheetContent
				side="bottom"
				showCloseButton={false}
				aria-describedby={undefined}
				className="gap-2 rounded-t-xl pb-[env(safe-area-inset-bottom)]"
			>
				<SheetHeader className="pb-0">
					<SheetTitle>{m.nav_more()}</SheetTitle>
				</SheetHeader>
				<ul className="grid grid-cols-3 gap-2 px-4">
					{items.map((item) => (
						<li key={item.to}>
							<SheetClose asChild>
								<Link
									to={item.to}
									className="flex flex-col items-center gap-1.5 rounded-lg p-3 text-center text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
								>
									<item.icon aria-hidden className="size-6" />
									<span className="max-w-full break-words">{item.label()}</span>
								</Link>
							</SheetClose>
						</li>
					))}
				</ul>
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
