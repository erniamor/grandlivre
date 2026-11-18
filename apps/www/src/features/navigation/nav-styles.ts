/** A tab of the phone's tab bar: its icon above its name, the current one in the primary color. */
export const tabClass =
	"flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1 text-muted-foreground text-xs focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 data-[status=active]:text-primary data-[current]:text-primary";

/** A page in the side bar: its icon alone on a tablet, with its name on a wide screen. */
export const sideLinkClass =
	"flex h-10 items-center gap-3 rounded-md px-3 font-medium text-muted-foreground text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 data-[status=active]:bg-accent data-[status=active]:text-accent-foreground max-lg:justify-center max-lg:px-0";
