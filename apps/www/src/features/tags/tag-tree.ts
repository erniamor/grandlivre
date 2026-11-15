import { type Locale, type Tag, tagDisplayName } from "@repo/schemas";

/** A tag with its name for the user and its child tags. */
export interface TagNode {
	tag: Tag;
	/** In the user's language, or else in another one. */
	name: string;
	children: TagNode[];
}

/**
 * Builds the tree of a household's tags, each level sorted by name the way
 * `locale` sorts. A tag whose parent is missing is shown at the root.
 */
export function buildTagTree(tags: Tag[], locale: Locale): TagNode[] {
	const nodes = new Map<string, TagNode>(
		tags.map((tag) => [
			tag.id,
			{ tag, name: tagDisplayName(tag.names, locale), children: [] },
		]),
	);
	const roots: TagNode[] = [];
	for (const node of nodes.values()) {
		const parent =
			node.tag.parentId === null ? undefined : nodes.get(node.tag.parentId);
		(parent ? parent.children : roots).push(node);
	}
	const collator = new Intl.Collator(locale, { sensitivity: "base" });
	const sort = (level: TagNode[]) => {
		level.sort((a, b) => collator.compare(a.name, b.name));
		for (const node of level) {
			sort(node.children);
		}
	};
	sort(roots);
	return roots;
}

/** A tag in a flat list, with the names leading to it: "Home › Internet". */
export interface TagPath {
	tag: Tag;
	path: string;
}

/** The tree in reading order, each tag with its full path. */
export function flattenTagTree(nodes: TagNode[], prefix = ""): TagPath[] {
	return nodes.flatMap((node) => {
		const path = `${prefix}${node.name}`;
		return [
			{ tag: node.tag, path },
			...flattenTagTree(node.children, `${path} › `),
		];
	});
}

/** The identifiers of a tag and of every tag under it. */
export function subtreeIds(tags: Tag[], tagId: string): Set<string> {
	const ids = new Set([tagId]);
	// Tags are few: repeat until no more child is found
	let grew = true;
	while (grew) {
		grew = false;
		for (const tag of tags) {
			if (tag.parentId !== null && ids.has(tag.parentId) && !ids.has(tag.id)) {
				ids.add(tag.id);
				grew = true;
			}
		}
	}
	return ids;
}
