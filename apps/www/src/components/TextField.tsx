import { Input, Label } from "@repo/ui";
import { type ComponentProps, type ReactNode, useId } from "react";

interface TextFieldProps extends ComponentProps<"input"> {
	label: string;
	/** Error shown under the field and announced with it. */
	error?: string;
	/** Shown next to the label: a "?" explaining the field, say. */
	hint?: ReactNode;
}

/** A labelled input with its error message. */
export function TextField({
	label,
	error,
	hint,
	id,
	...props
}: TextFieldProps) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;
	const errorId = `${fieldId}-error`;

	return (
		<div className="grid gap-2">
			{hint ? (
				<div className="flex items-center gap-1">
					<Label htmlFor={fieldId}>{label}</Label>
					{hint}
				</div>
			) : (
				<Label htmlFor={fieldId}>{label}</Label>
			)}
			<Input
				id={fieldId}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				{...props}
			/>
			{error && (
				<p id={errorId} className="text-destructive text-sm">
					{error}
				</p>
			)}
		</div>
	);
}
