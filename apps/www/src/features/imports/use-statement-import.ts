import type {
	StatementImport,
	StatementImportPlan,
	StatementPreview,
} from "@repo/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	buildPlan,
	choicesFor,
	type Destination,
	type DraftProblem,
	type ImportDraft,
	initialDraft,
	type LineChoice,
	needsPreview,
	redraft,
	targetsOf,
} from "@/features/imports/import-draft";
import { getApi } from "@/lib/api";
import { getLocale } from "@/paraglide/runtime";

/** A file read, and what the member decides of it. */
export interface Reviewing {
	file: File;
	preview: StatementPreview;
	draft: ImportDraft;
}

/** A file imported: what the import did, and the file read again since. */
export interface Imported {
	result: StatementImport;
	/** Null when the file couldn't be read again: the import itself is done. */
	preview: StatementPreview | null;
}

const sameDestination = (a: Destination | undefined, b: Destination) =>
	a?.kind === b.kind &&
	(b.kind !== "account" ||
		(a.kind === "account" && a.accountId === b.accountId));

/**
 * Importing a statement, step by step: a file read and compared with the
 * household (again whenever an account of it goes to another account), the
 * member's decisions, the import, and what it did.
 */
export function useStatementImport(
	householdId: string,
	currency: string,
	fromAccountId?: string,
) {
	const queryClient = useQueryClient();
	const [reviewing, setReviewing] = useState<Reviewing | null>(null);
	const [problems, setProblems] = useState<DraftProblem[]>([]);
	const [imported, setImported] = useState<Imported | null>(null);

	const read = useMutation({
		mutationFn: async ({
			file,
			draft,
			previous,
		}: {
			file: File;
			draft?: ImportDraft;
			previous?: StatementPreview;
		}): Promise<Reviewing> => {
			const { imports } = getApi();
			const preview = await imports.preview(householdId, {
				file,
				targets: draft ? targetsOf(draft) : [],
			});
			if (draft && previous) {
				return { file, preview, draft: redraft(draft, previous, preview) };
			}
			const initial = initialDraft(preview, fromAccountId);
			if (!needsPreview(preview, initial)) {
				return { file, preview, draft: initial };
			}
			// The page's account, for a file of one account: compared with it
			const compared = await imports.preview(householdId, {
				file,
				targets: targetsOf(initial),
			});
			return {
				file,
				preview: compared,
				draft: redraft(initial, preview, compared),
			};
		},
		onSuccess: (next) => {
			setReviewing(next);
			setProblems([]);
		},
	});

	const save = useMutation({
		mutationFn: async ({
			file,
			plan,
		}: {
			file: File;
			plan: StatementImportPlan;
		}): Promise<Imported> => {
			const { imports } = getApi();
			const result = await imports.create(householdId, { file, plan });
			// Read again: the accounts it went to, known now, and their balances
			const preview = await imports
				.preview(householdId, { file })
				.catch(() => null);
			return { result, preview };
		},
		onSuccess: (done) => {
			setImported(done);
			setReviewing(null);
			queryClient.invalidateQueries({ queryKey: ["households", householdId] });
		},
	});

	const update = (change: (current: Reviewing) => Reviewing) =>
		setReviewing((current) => (current ? change(current) : current));

	return {
		reviewing,
		imported,
		problems,
		reading: read.isPending,
		readError: read.error,
		saving: save.isPending,
		saveError: save.error,
		/** Reads a file, the first time or again. */
		choose(file: File) {
			save.reset();
			read.mutate({ file });
		},
		setDestination(index: number, destination: Destination) {
			if (!reviewing) {
				return;
			}
			const before = reviewing.draft.destinations[index];
			const account = reviewing.preview.accounts.find(
				(each) => each.index === index,
			);
			const draft: ImportDraft = {
				destinations: { ...reviewing.draft.destinations, [index]: destination },
				choices:
					sameDestination(before, destination) || !account
						? reviewing.draft.choices
						: {
								...reviewing.draft.choices,
								[index]: choicesFor(account, destination),
							},
			};
			setReviewing({ ...reviewing, draft });
			if (needsPreview(reviewing.preview, draft)) {
				read.mutate({
					file: reviewing.file,
					draft,
					previous: reviewing.preview,
				});
			}
		},
		setChoice(index: number, externalId: string, choice: LineChoice) {
			update((current) => ({
				...current,
				draft: {
					...current.draft,
					choices: {
						...current.draft.choices,
						[index]: { ...current.draft.choices[index], [externalId]: choice },
					},
				},
			}));
		},
		submit() {
			if (!reviewing) {
				return;
			}
			const built = buildPlan(
				reviewing.preview,
				reviewing.draft,
				currency,
				getLocale(),
			);
			setProblems(built.problems);
			if (built.plan) {
				save.mutate({ file: reviewing.file, plan: built.plan });
			}
		},
		/** Back to choosing a file. */
		restart() {
			setReviewing(null);
			setImported(null);
			setProblems([]);
			read.reset();
			save.reset();
		},
	};
}

export type StatementImporter = ReturnType<typeof useStatementImport>;
