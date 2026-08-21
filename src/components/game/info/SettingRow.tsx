type Tone = 'amber' | 'blue' | 'purple' | 'green';

const TONES: Record<Tone, string> = {
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
};

type SettingRowProps = {
    icon: React.ReactNode;
    tone: Tone;
    title: string;
    description: string;
    /** The control on the trailing edge — a switch, a picker, a button. */
    children: React.ReactNode;
    /** Makes the icon interactive, e.g. to preview a sound. */
    onIconClick?: () => void;
};

/** Shared layout for one preference: tinted icon, label pair, trailing control. */
export function SettingRow({ icon, tone, title, description, children, onIconClick }: SettingRowProps) {
    const interactive = onIconClick
        ? 'cursor-pointer hover:brightness-95 dark:hover:brightness-125 transition-all active:scale-95'
        : '';

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${TONES[tone]} ${interactive}`} onClick={onIconClick}>
                    {icon}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{title}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
                </div>
            </div>
            {children}
        </div>
    );
}
