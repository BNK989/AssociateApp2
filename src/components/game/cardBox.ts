/**
 * The desktop card's geometry, shared by the board shell and the overlays that
 * sit on top of it.
 *
 * These overlays are `fixed` because they must cover the board including its
 * header, which they render inside. On a phone that is the whole viewport and
 * correct. On desktop the board is an inset card, so without this the settings
 * sheet and the welcome card would spill across the full screen while the
 * board they belong to sat in the middle of it.
 *
 * Keep in sync with the card classes in `GameShell`.
 */
export const CARD_BOX = 'md:inset-y-6 md:mx-auto md:max-w-xl md:rounded-2xl md:overflow-hidden';
