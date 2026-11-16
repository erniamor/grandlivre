/**
 * The rows of a CSV text, as fields: separated by commas, quoted with double
 * quotes when they hold a comma, a quote ("" inside) or a line break. Lines
 * end with \n or \r\n; blank lines are left out.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	const endField = () => {
		row.push(field);
		field = "";
	};
	const endRow = () => {
		endField();
		if (row.some((each) => each.trim() !== "")) {
			rows.push(row);
		}
		row = [];
	};
	for (let at = 0; at < text.length; at++) {
		const char = text[at];
		if (quoted) {
			if (char === '"' && text[at + 1] === '"') {
				field += '"';
				at++;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ",") {
			endField();
		} else if (char === "\n") {
			endRow();
		} else if (char !== "\r") {
			field += char;
		}
	}
	if (field !== "" || row.length > 0) {
		endRow();
	}
	return rows;
}
