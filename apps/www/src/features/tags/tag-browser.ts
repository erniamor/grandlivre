import {
	flattenTagTree,
	type TagNode,
	type TagPath,
} from "@/features/tags/tag-tree";
import { matchesSearch, searchWords } from "@/lib/search";

/** A level of the tree, as the tag picker shows it. */
export interface TagLevel {
	/** The tags opened to reach it, from the root: none at the root. */
	trail: TagNode[];
	/** What it lists: the root tags, or the child tags of the last one opened. */
	children: TagNode[];
}

/**
 * The level reached by opening the tags of `trail` (their identifiers, from
 * the root) one after the other. It stops where a tag is missing: one
 * deleted meanwhile by another member.
 */
export function tagLevel(tree: TagNode[], trail: string[]): TagLevel {
	const opened: TagNode[] = [];
	let children = tree;
	for (const id of trail) {
		const node = children.find((each) => each.tag.id === id);
		if (!node) {
			break;
		}
		opened.push(node);
		children = node.children;
	}
	return { trail: opened, children };
}

/**
 * The identifiers of the tags above `tagId`, from the root: the trail to the
 * level that lists it. Empty for a root tag, or one not found.
 */
export function trailTo(tree: TagNode[], tagId: string | null): string[] {
	const find = (level: TagNode[], above: string[]): string[] | null => {
		for (const node of level) {
			if (node.tag.id === tagId) {
				return above;
			}
			const below = find(node.children, [...above, node.tag.id]);
			if (below) {
				return below;
			}
		}
		return null;
	};
	return tagId === null ? [] : (find(tree, []) ?? []);
}

/**
 * The tags whose path holds every word searched ("auto ass" finds
 * "Auto › Assurance"), accents and case aside, in the tree's order. None for
 * an empty search: the picker then shows its levels.
 */
export function searchTags(tree: TagNode[], search: string): TagPath[] {
	const searched = searchWords(search);
	if (searched.length === 0) {
		return [];
	}
	return flattenTagTree(tree).filter(({ path }) =>
		matchesSearch(path, searched),
	);
}

/** The path of the tag `tagId` ("Home › Internet"), null when it isn't there. */
export function tagPath(tree: TagNode[], tagId: string | null): string | null {
	return flattenTagTree(tree).find(({ tag }) => tag.id === tagId)?.path ?? null;
}
