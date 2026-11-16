import type { Household, SharingWeight } from "@repo/schemas";
import { Button, Input, Label, toast } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { useSharingChange } from "@/features/sharing/use-sharing-change";
import { getApi } from "@/lib/api";
import { actionErrorMessage, errorMessage } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";

interface DefaultSplitFormProps {
	household: Household;
	weights: SharingWeight[];
	nameOf: (userId: string) => string;
}

/**
 * How a shared expense is split unless said otherwise: a weight per member
 * (1 and 1: in halves; 60 and 40). Its owners change it; the others read it.
 */
export function DefaultSplitForm({
	household,
	weights,
	nameOf,
}: DefaultSplitFormProps) {
	const id = useId();
	const refresh = useSharingChange(household.id);
	const [values, setValues] = useState(() =>
		Object.fromEntries(
			weights.map(({ userId, weight }) => [userId, String(weight)]),
		),
	);
	const [error, setError] = useState<string>();
	const save = useMutation({
		mutationFn: (input: SharingWeight[]) =>
			getApi().sharing.setWeights(household.id, { weights: input }),
		onSuccess: async () => {
			await refresh();
			toast.success(m.toast_default_split_saved());
		},
		onError: (failure) => setError(actionErrorMessage(failure)),
	});

	if (household.role !== "owner") {
		return (
			<p className="text-muted-foreground">
				{weights
					.map(({ userId, weight }) => `${nameOf(userId)} ${weight}`)
					.join(" · ")}
			</p>
		);
	}

	return (
		<form
			noValidate
			className="grid gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				const parsed = weights.map(({ userId }) => ({
					userId,
					text: (values[userId] ?? "").trim(),
				}));
				if (
					parsed.some(({ text }) => !/^\d+$/.test(text)) ||
					parsed.every(({ text }) => Number(text) === 0)
				) {
					setError(errorMessage("share_weight_invalid"));
					return;
				}
				setError(undefined);
				save.mutate(
					parsed.map(({ userId, text }) => ({ userId, weight: Number(text) })),
				);
			}}
		>
			<ul className="grid gap-2">
				{weights.map(({ userId }) => (
					<li key={userId} className="flex items-center gap-3">
						<Label htmlFor={`${id}-${userId}`} className="min-w-24 flex-1">
							{nameOf(userId)}
						</Label>
						<Input
							id={`${id}-${userId}`}
							className="w-24"
							inputMode="numeric"
							autoComplete="off"
							aria-label={m.share_weight_label({ name: nameOf(userId) })}
							value={values[userId] ?? ""}
							onChange={(event) =>
								setValues({ ...values, [userId]: event.target.value })
							}
						/>
					</li>
				))}
			</ul>
			<p className="text-muted-foreground text-sm">{m.share_weights_hint()}</p>
			<FormAlert message={error} />
			<Button
				type="submit"
				variant="outline"
				className="justify-self-start"
				disabled={save.isPending}
			>
				{m.default_split_save()}
			</Button>
		</form>
	);
}
