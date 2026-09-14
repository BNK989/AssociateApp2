/**
 * One stretch of the player's word, and the panels that decide how it goes.
 *
 * The page used to be eight equal boxes in the order the policies were written:
 * the ladder, then rewards, then the answer box, then the stuck offer. Nothing
 * about that order was wrong, and nothing about it told a game master where they
 * were -- every box announced a mechanism, none announced a moment, so the only
 * way to find the setting you wanted was to have written it.
 *
 * So the boxes are grouped by when the player meets them instead, and each group
 * says which moment it owns before the first field. The heading is the spine;
 * the sentence under it is the orientation, and it is deliberately about the
 * player rather than about the settings.
 */

type SettingsGroupProps = {
    /** The moment in the player's word, named from the player's side of it. */
    title: string;
    /** One sentence placing that moment. Not a summary of the fields below. */
    blurb: string;
    children: React.ReactNode;
};

export function SettingsGroup({ title, blurb, children }: SettingsGroupProps) {
    return (
        <section>
            {/* A rail rather than a box: the panels below are already boxes, and
                a box around boxes reads as another level of nesting to open. */}
            <div className="mb-3 border-s-2 border-brand ps-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    {title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
            </div>

            <div className="space-y-6">{children}</div>
        </section>
    );
}
