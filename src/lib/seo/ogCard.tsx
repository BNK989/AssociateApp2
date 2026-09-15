import { ImageResponse } from 'next/og';

/**
 * The picture a shared link turns into.
 *
 * Before this existed the app pointed both `openGraph.images` and Twitter's
 * `summary_large_image` card at `/icon-512x512.png` — a square app icon in a
 * 1.91:1 slot, which every chat client letterboxes into a small blob with two
 * grey bars. A share is the app's cheapest acquisition channel and that blob
 * was the whole first impression.
 *
 * Deliberately not translated. Satori embeds only the fonts it is handed, and
 * the default set has no Hebrew or Arabic coverage — a localised card would
 * render those two locales as boxes, which is worse than English. §6 asks for
 * base text in English anyway; this is base text.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/** Tailwind purple-600, the hex behind `--brand`'s oklch. Satori cannot parse oklch. */
const BRAND = '#9333ea';
const INK = '#faf5ff';
const MUTED = '#c4b5fd';

type OgCardArgs = {
    /** Small line above the wordmark — the puzzle number, or nothing. */
    eyebrow?: string;
    headline: string;
    subhead: string;
    /**
     * The tile row along the bottom, echoing the share grid. `true` is a solved
     * tile. Kept abstract rather than showing a real result: the card is served
     * to everyone, so it must never leak how a particular day went.
     */
    tiles?: readonly boolean[];
};

const DEFAULT_TILES = [true, true, false, true, true, true, false, true] as const;

/**
 * Every node below carries an explicit `display: flex`. Satori has no block
 * layout — a div with more than one child and no display set throws at render,
 * which surfaces as a broken preview rather than an error anyone sees.
 */
export function renderOgCard({ eyebrow, headline, subhead, tiles = DEFAULT_TILES }: OgCardArgs): ImageResponse {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '80px',
                    background: `linear-gradient(135deg, #1b0733 0%, #2e0f52 55%, ${BRAND} 160%)`,
                    color: INK,
                    fontFamily: 'sans-serif',
                }}
            >
                {eyebrow ? (
                    <div
                        style={{
                            display: 'flex',
                            alignSelf: 'flex-start',
                            padding: '10px 24px',
                            marginBottom: '28px',
                            borderRadius: '999px',
                            background: 'rgba(196, 181, 253, 0.16)',
                            border: `2px solid ${MUTED}`,
                            color: MUTED,
                            fontSize: 30,
                            letterSpacing: '0.08em',
                        }}
                    >
                        {eyebrow}
                    </div>
                ) : null}

                <div style={{ display: 'flex', fontSize: 108, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {headline}
                </div>

                <div style={{ display: 'flex', marginTop: '20px', fontSize: 40, color: MUTED, maxWidth: '900px' }}>
                    {subhead}
                </div>

                <div style={{ display: 'flex', gap: '14px', marginTop: '56px' }}>
                    {tiles.map((solved, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                width: '76px',
                                height: '76px',
                                borderRadius: '16px',
                                background: solved ? BRAND : 'rgba(250, 245, 255, 0.10)',
                                border: solved ? `3px solid ${MUTED}` : '3px solid rgba(250, 245, 255, 0.22)',
                            }}
                        />
                    ))}
                </div>
            </div>
        ),
        OG_SIZE,
    );
}
