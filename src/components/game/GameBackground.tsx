import styles from './GameBackground.module.css';

type GameBackgroundProps = {
    /**
     * `panel` fills its positioned parent — the chat list inside the board.
     * `room` fills the viewport behind the desktop game card.
     */
    variant?: 'panel' | 'room';
};

/**
 * The drifting ambient blobs behind the board.
 *
 * The blobs are sized in `vmin` and offset in `vw`, so they only compose
 * correctly when their container is roughly the viewport. That holds on a
 * phone, where the board *is* the viewport, and fails on desktop, where the
 * board is a narrow column and the blobs spill out of it. So on desktop the
 * panel drops its blobs — keeping only the flat surface tint — and the `room`
 * copy behind the card carries the atmosphere instead.
 */
export function GameBackground({ variant = 'panel' }: GameBackgroundProps) {
    const ballClass = variant === 'panel'
        ? `${styles.ball} md:hidden`
        : styles.ball;

    return (
        <div className={`${styles.background} bg-gray-200 dark:bg-neutral-900 transition-colors duration-300`}>
            {/* 7 balls as per the CSS configuration */}
            <span className={ballClass}></span>
            <span className={ballClass}></span>
            <span className={ballClass}></span>
            <span className={ballClass}></span>
            <span className={ballClass}></span>
            <span className={ballClass}></span>
            <span className={ballClass}></span>
        </div>
    );
}
