import styles from './GameBackground.module.css';

export function GameBackground() {
    return (
        <div className={`${styles.background} bg-gray-200 dark:bg-neutral-900 transition-colors duration-300`}>
            {/* 8 balls as per the CSS configuration */}
            <span className={styles.ball}></span>
            <span className={styles.ball}></span>
            <span className={styles.ball}></span>
            <span className={styles.ball}></span>
            <span className={styles.ball}></span>
            <span className={styles.ball}></span>
            <span className={styles.ball}></span>
            {/* <span className={styles.ball}></span> */}
        </div>
    );
}
