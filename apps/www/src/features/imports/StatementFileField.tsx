import { buttonVariants, cn } from "@repo/ui";
import { FileUpIcon } from "lucide-react";
import { useId } from "react";
import { FormAlert } from "@/components/FormAlert";
import { m } from "@/paraglide/messages";

interface StatementFileFieldProps {
	reading: boolean;
	error?: string;
	onFile: (file: File) => void;
}

/** Chooses a statement file: the CSV a bank exports. */
export function StatementFileField({
	reading,
	error,
	onFile,
}: StatementFileFieldProps) {
	const inputId = useId();
	const hintId = useId();

	return (
		<div className="grid gap-2">
			{/* The input is the control, its label the button the user sees */}
			<label
				htmlFor={inputId}
				className={cn(
					buttonVariants(),
					"cursor-pointer justify-self-start has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2",
					reading && "pointer-events-none opacity-50",
				)}
			>
				<FileUpIcon aria-hidden />
				{reading ? m.import_file_reading() : m.import_file_button()}
				<input
					id={inputId}
					type="file"
					accept=".csv,text/csv"
					className="sr-only"
					aria-describedby={hintId}
					disabled={reading}
					onChange={(event) => {
						const file = event.currentTarget.files?.[0];
						// The same file can be chosen again after an error
						event.currentTarget.value = "";
						if (file) {
							onFile(file);
						}
					}}
				/>
			</label>
			<p id={hintId} className="text-muted-foreground text-sm">
				{m.import_file_hint()}
			</p>
			<FormAlert message={error} />
		</div>
	);
}
