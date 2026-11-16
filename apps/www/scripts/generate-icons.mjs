// Draws the app's icons (public/) from the logo: an open ledger, its left
// page ruled, its right page turned into rising bars, on a night navy
// rounded square. The same shapes as src/components/LogoMark.tsx: keep them
// in sync. Two drawings: the full one for the large icons (180 px and up),
// the compact one (thicker rules, drawn larger in its square) for the
// browser's tab, where the thin rules would vanish.
// No dependency: the shapes are drawn with distance functions and a
// polygon test, antialiased by supersampling, the PNGs encoded with zlib.
// Run after changing the logo or its colors: pnpm --filter www icons
import { writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

// The logo's own colors, the same in every theme
const NAVY = "#0F172A";
const PAGE = "#F8FAFC";
const MINT = "#34D399";
const EMERALD = "#10B981";
const AMBER = "#FBBF24";

// In its 200 × 200 viewBox
const VIEWBOX = 200;
const CORNER_RADIUS = 44;
const PAGE_PATH =
	"M 46 66 C 46 60, 52 56, 58 58 L 94 70 L 94 142 L 54 128 C 49 126, 46 121, 46 116 Z";
const RULES = [
	[
		[60, 84],
		[80, 90],
	],
	[
		[60, 102],
		[80, 108],
	],
];
const BARS = [
	{ x: 106, y: 106, width: 12, height: 36, color: MINT },
	{ x: 124, y: 86, width: 12, height: 52, color: EMERALD },
	{ x: 142, y: 62, width: 12, height: 70, color: AMBER },
];
const BAR_RADIUS = 6;

/** The full drawing, and the compact one for small sizes. */
const DRAWINGS = {
	full: { rule: 6, scale: 1 },
	compact: { rule: 10, scale: 1.22 },
};
const SAMPLES = 4;

const rgb = (hex) =>
	[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

/** The page's outline as a polygon: its curves cut into short straight steps. */
function pagePolygon() {
	const points = [];
	const tokens = PAGE_PATH.replaceAll(",", " ").split(/\s+/).filter(Boolean);
	let at = 0;
	let current = [0, 0];
	const number = () => Number(tokens[at++]);
	while (at < tokens.length) {
		const command = tokens[at++];
		if (command === "M" || command === "L") {
			current = [number(), number()];
			points.push(current);
		} else if (command === "C") {
			const c1 = [number(), number()];
			const c2 = [number(), number()];
			const end = [number(), number()];
			const start = current;
			for (let step = 1; step <= 16; step++) {
				const t = step / 16;
				const u = 1 - t;
				points.push(
					[0, 1].map(
						(axis) =>
							u ** 3 * start[axis] +
							3 * u * u * t * c1[axis] +
							3 * u * t * t * c2[axis] +
							t ** 3 * end[axis],
					),
				);
			}
			current = end;
		}
	}
	return points;
}
const PAGE_POLYGON = pagePolygon();

function insidePolygon(x, y, polygon) {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, yi] = polygon[i];
		const [xj, yj] = polygon[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

function insideRoundedRect(x, y, { x: left, y: top, width, height }, radius) {
	const dx = Math.max(left + radius - x, 0, x - (left + width - radius));
	const dy = Math.max(top + radius - y, 0, y - (top + height - radius));
	return (
		x >= left &&
		x <= left + width &&
		y >= top &&
		y <= top + height &&
		dx * dx + dy * dy <= radius * radius
	);
}

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
	const t = Math.max(
		0,
		Math.min(
			1,
			((x - ax) * (bx - ax) + (y - ay) * (by - ay)) /
				((bx - ax) ** 2 + (by - ay) ** 2),
		),
	);
	return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
}

/**
 * The color at a point of the logo, the topmost shape's; null outside it.
 * `fullBleed`: the background fills the whole square, for the icons the
 * system crops itself (maskable, Apple).
 */
function colorAt(px, py, { rule, scale }, fullBleed) {
	if (
		!fullBleed &&
		!insideRoundedRect(
			px,
			py,
			{ x: 0, y: 0, width: VIEWBOX, height: VIEWBOX },
			CORNER_RADIUS,
		)
	) {
		return null;
	}
	// The drawing, larger in its square in the compact logo
	const x = (px - VIEWBOX / 2) / scale + VIEWBOX / 2;
	const y = (py - VIEWBOX / 2) / scale + VIEWBOX / 2;
	for (const bar of BARS) {
		if (insideRoundedRect(x, y, bar, BAR_RADIUS)) {
			return bar.color;
		}
	}
	if (RULES.some(([a, b]) => distanceToSegment(x, y, a, b) <= rule / 2)) {
		return NAVY;
	}
	if (insidePolygon(x, y, PAGE_POLYGON)) {
		return PAGE;
	}
	return NAVY;
}

/** RGBA pixels of the icon, `size` pixels a side. */
function draw(size, drawing, fullBleed) {
	const pixels = Buffer.alloc(size * size * 4);
	const scale = VIEWBOX / size;
	for (let py = 0; py < size; py++) {
		for (let px = 0; px < size; px++) {
			const sum = [0, 0, 0];
			let covered = 0;
			for (let sy = 0; sy < SAMPLES; sy++) {
				for (let sx = 0; sx < SAMPLES; sx++) {
					const color = colorAt(
						(px + (sx + 0.5) / SAMPLES) * scale,
						(py + (sy + 0.5) / SAMPLES) * scale,
						drawing,
						fullBleed,
					);
					if (color) {
						const [r, g, b] = rgb(color);
						sum[0] += r;
						sum[1] += g;
						sum[2] += b;
						covered++;
					}
				}
			}
			const offset = (py * size + px) * 4;
			for (let channel = 0; channel < 3; channel++) {
				pixels[offset + channel] = covered
					? Math.round(sum[channel] / covered)
					: 0;
			}
			pixels[offset + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
		}
	}
	return pixels;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8; // bits per channel
	header[9] = 6; // RGBA
	// Each row starts with its filter type: 0, none
	const rows = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y++) {
		pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(rows, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** The logo as SVG, in one of its drawings. */
function svg({ rule, scale }) {
	const rules = RULES.map(
		([[x1, y1], [x2, y2]]) =>
			`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${NAVY}" stroke-width="${rule}" stroke-linecap="round"/>`,
	).join("");
	const bars = BARS.map(
		({ x, y, width, height, color }) =>
			`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${BAR_RADIUS}" fill="${color}"/>`,
	).join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"><title>Grand Livre</title><rect width="${VIEWBOX}" height="${VIEWBOX}" rx="${CORNER_RADIUS}" fill="${NAVY}"/><g transform="translate(100 100) scale(${scale}) translate(-100 -100)"><path d="${PAGE_PATH}" fill="${PAGE}"/>${rules}${bars}</g></svg>\n`;
}

const outputs = [
	["icon-192.png", 192, false],
	["icon-512.png", 512, false],
	["icon-maskable-512.png", 512, true],
	["apple-touch-icon.png", 180, true],
];
const publicDir = new URL("../public/", import.meta.url);
// The browser's tab: small, the compact drawing
writeFileSync(new URL("favicon.svg", publicDir), svg(DRAWINGS.compact));
for (const [name, size, fullBleed] of outputs) {
	writeFileSync(
		new URL(name, publicDir),
		png(size, draw(size, DRAWINGS.full, fullBleed)),
	);
}
console.log(`Icons written to ${publicDir.pathname}`);
