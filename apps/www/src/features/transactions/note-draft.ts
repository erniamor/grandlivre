import type { TransactionDraft } from "@repo/schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

/**
 * A draft of the assistant goes from the page where the note was typed, or
 * the receipt scanned, to the transaction form through the query cache,
 * under an id the form's address carries (`/transactions/new?draft=…`), with
 * the receipt's photo to check it against. Nothing to fetch: after a reload
 * the cache is empty, on the server as in the browser, and the form starts
 * blank. The photo never leaves the browser's memory.
 */
const noteDraftKey = (id: string) => ["note-draft", id] as const;
const draftPhotoKey = (id: string) => ["note-draft", id, "photo"] as const;

function newId(): string {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The draft kept under `id`, if it is still there. */
export function useNoteDraft(
	id: string | undefined,
): TransactionDraft | undefined {
	const queryClient = useQueryClient();
	return id
		? queryClient.getQueryData<TransactionDraft>(noteDraftKey(id))
		: undefined;
}

/** The photo of the receipt the draft under `id` was read from, if any. */
export function useDraftPhoto(id: string | undefined): Blob | undefined {
	const queryClient = useQueryClient();
	return id ? queryClient.getQueryData<Blob>(draftPhotoKey(id)) : undefined;
}

/** Opens the transaction form on a draft, to review it. */
export function useOpenDraft() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return (
		draft: TransactionDraft,
		options: { replace?: boolean; photo?: Blob } = {},
	) => {
		const id = newId();
		queryClient.setQueryData(noteDraftKey(id), draft);
		if (options.photo) {
			queryClient.setQueryData(draftPhotoKey(id), options.photo);
		}
		return navigate({
			to: "/transactions/new",
			search: { draft: id },
			replace: options.replace,
		});
	};
}
