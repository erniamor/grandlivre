import { LOCALES, type Locale, type Tag, type TagNames } from "@repo/schemas";
import { Button } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { localeNames } from "@/features/i18n/locale-names";
import {
	buildTagTree,
	flattenTagTree,
	subtreeIds,
} from "@/features/tags/tag-tree";
import { formErrors } from "@/lib/error-messages";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/** What the tag form sends: every field it shows. */
export interface TagFormInput {
	names: TagNames;
	parentId: string | null;
}

interface TagFormProps {
	/** Every tag of the household, to choose the parent among. */
	tags: Tag[];
	/** The tag to change; without it, the form creates one. */
	tag?: Tag;
	/** The parent proposed for a new tag. */
	defaultParentId?: string | null;
	submitLabel: string;
	save: (input: TagFormInput) => Promise<Tag>;
	onSaved: (tag: Tag) => void | Promise<void>;
}

// A select's value is a string: this one stands for "no parent"
const ROOT = "";

/** The user's language first: it is the name they are most likely to give. */
function localesFrom(first: Locale): Locale[] {
	return [first, ...LOCALES.filter((locale) => locale !== first)];
}

/** Creates or changes a tag: its name in each language and its parent. */
export function TagForm({
	tags,
	tag,
	defaultParentId = null,
	submitLabel,
	save,
	onSaved,
}: TagFormProps) {
	const locale = getLocale();
	const [parentId, setParentId] = useState(
		(tag ? tag.parentId : defaultParentId) ?? ROOT,
	);
	const mutation = useMutation({ mutationFn: save, onSuccess: onSaved });
	const errors = mutation.error ? formErrors(mutation.error) : { fields: {} };

	// A tag can't go under itself or under one of its own sub-tags
	const excluded = tag ? subtreeIds(tags, tag.id) : new Set<string>();
	const parentOptions: SelectOption<string>[] = [
		{ value: ROOT, label: m.tag_parent_none() },
		...flattenTagTree(buildTagTree(tags, locale))
			.filter((option) => !excluded.has(option.tag.id))
			.map((option) => ({ value: option.tag.id, label: option.path })),
	];

	return (
		<form
			noValidate
			className="grid gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				const names: TagNames = {};
				for (const language of LOCALES) {
					// A language left empty has no name: the others stand in for it
					const name = String(data.get(`name-${language}`) ?? "").trim();
					if (name) {
						names[language] = name;
					}
				}
				mutation.mutate({
					names,
					parentId: parentId === ROOT ? null : parentId,
				});
			}}
		>
			<fieldset className="grid gap-4">
				<legend className="mb-2 font-medium text-sm">
					{m.tag_names_label()}
				</legend>
				{localesFrom(locale).map((language) => (
					<TextField
						key={language}
						label={localeNames[language]}
						name={`name-${language}`}
						lang={language}
						autoComplete="off"
						defaultValue={tag?.names[language]}
						error={errors.fields[`names.${language}`]}
					/>
				))}
				<p className="text-muted-foreground text-sm">{m.tag_names_hint()}</p>
				{/* No name at all: the error is about the group, not one field */}
				<FormAlert message={errors.fields.names} />
			</fieldset>
			<div className="grid gap-2">
				<SelectField
					label={m.tag_parent_label()}
					value={parentId}
					options={parentOptions}
					onChange={setParentId}
					tone="default"
					className="grid items-stretch font-medium"
				/>
				<FormAlert message={errors.fields.parentId} />
			</div>
			<FormAlert message={errors.form} />
			<Button type="submit" disabled={mutation.isPending}>
				{submitLabel}
			</Button>
		</form>
	);
}
