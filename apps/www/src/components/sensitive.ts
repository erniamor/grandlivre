/**
 * What is sensitive on screen (amounts, payees, notes, account numbers):
 * blurred, and not selectable, while the private mode is on (`data-private`
 * on <html>, see features/privacy). The layout stays: what is hidden still
 * takes its place.
 */
export const sensitiveClass =
	"private:select-none private:blur-[0.3em] motion-safe:transition-[filter]";
