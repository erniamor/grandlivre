interface LogoMarkProps {
	className?: string;
}

/**
 * The product's mark, its compact drawing (thick rules, drawn large in its
 * square) for small sizes: an open ledger whose right page turns into
 * rising bars. Its colors are its own, the same in every theme: a brand
 * mark, the one place colors aren't the theme's tokens. The same shapes as
 * scripts/generate-icons.mjs: keep them in sync.
 */
export function LogoMark({ className }: LogoMarkProps) {
	return (
		<svg viewBox="0 0 200 200" aria-hidden="true" className={className}>
			<rect width="200" height="200" rx="44" fill="#0F172A" />
			<g transform="translate(100 100) scale(1.22) translate(-100 -100)">
				<path
					d="M 46 66 C 46 60, 52 56, 58 58 L 94 70 L 94 142 L 54 128 C 49 126, 46 121, 46 116 Z"
					fill="#F8FAFC"
				/>
				<line
					x1="60"
					y1="84"
					x2="80"
					y2="90"
					stroke="#0F172A"
					strokeWidth="10"
					strokeLinecap="round"
				/>
				<line
					x1="60"
					y1="102"
					x2="80"
					y2="108"
					stroke="#0F172A"
					strokeWidth="10"
					strokeLinecap="round"
				/>
				<rect x="106" y="106" width="12" height="36" rx="6" fill="#34D399" />
				<rect x="124" y="86" width="12" height="52" rx="6" fill="#10B981" />
				<rect x="142" y="62" width="12" height="70" rx="6" fill="#FBBF24" />
			</g>
		</svg>
	);
}
