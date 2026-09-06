import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameInput } from './GameInput';
import { GameState, Message, Player } from '@/hooks/useGameLogic';
import type { User } from '@supabase/supabase-js';

/** Minimal prop shape shared by the stubbed-out UI components below. */
type MockComponentProps = {
    children?: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler;
    disabled?: boolean;
};

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Send: () => <div data-testid="send-icon" />,
    Loader2: () => <div data-testid="loader-icon" />,
    Shuffle: () => <div data-testid="shuffle-icon" />,
    Pause: () => <div data-testid="pause-icon" />,
    Play: () => <div data-testid="play-icon" />,
    Settings: () => <div data-testid="settings-icon" />,
    Lightbulb: () => <div data-testid="lightbulb-icon" />,
    Flag: () => <div data-testid="flag-icon" />,
    Clock: () => <div data-testid="clock-icon" />,
    Palette: () => <div data-testid="palette-icon" />,
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        button: ({ children, onClick, disabled }: MockComponentProps) => (
            <button onClick={onClick} disabled={disabled}>{children}</button>
        ),
        div: ({ children, className }: MockComponentProps) => <div className={className}>{children}</div>,
        rect: ({ className }: MockComponentProps) => <rect className={className} />,
    },
    AnimatePresence: ({ children }: MockComponentProps) => <div>{children}</div>,
}));

// Mock Sonner
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        dismiss: vi.fn(),
    },
}));

// Mock Game Logic/Config
vi.mock('@/lib/gameConfig', () => ({
    GAME_CONFIG: {
        MESSAGE_MAX_LENGTH: 50,
        DEFAULT_AUTO_HINT_ENABLED: true,
        DEFAULT_AUTO_HINT_DURATION: 20,
        DEFAULT_AUTO_HINT_REVEAL_TYPE: 'STEP',
        PERCENT_REVEALED_SHUFFLE_HINT: 0.66,
    },
    // These moved here from gameLogic/dailyScoring when the balance constants
    // were consolidated; the modules under test read them through this module.
    HINT_COSTS: { TIER_1: 0.1, TIER_2: 0.1, TIER_3: 0.4 },
    MAX_HINT_LEVEL: 3,
    MAX_STRIKES: 3,
    MATCH_THRESHOLD: 0.8,
    STREAK_BONUS_AT: 3,
    STREAK_MULTIPLIER: 1.5,
    // Reached through the colour key's default sample tile, not by the input itself.
    CIPHER_SIGNS: [...'⊗⊕⊖'],
}));

vi.mock('@/lib/gameLogic', () => ({
    calculateMessageValue: () => 100,
    calculateRevealedPercentage: () => 0,
    HINT_COSTS: {
        TIER_1: 0.1,
        TIER_2: 0.1,
        TIER_3: 0.4,
    },
}));

// Mock UI components
vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));


vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: MockComponentProps) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: MockComponentProps) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: MockComponentProps) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: MockComponentProps) => <div onClick={onClick}>{children}</div>,
}));

/**
 * Stubs `matchMedia` for one test. jsdom ships without it, which is also the
 * production fallback path: no matchMedia means no autofocus.
 */
function stubPointer(kind: 'fine' | 'coarse' | 'absent') {
    if (kind === 'absent') {
        Reflect.deleteProperty(window, 'matchMedia');
        return;
    }
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
            matches: query.includes(`pointer: ${kind}`),
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }),
    });
}

describe('GameInput desktop autofocus', () => {
    const props = {
        game: { id: '1', status: 'solving', current_turn_user_id: 'user1' } as GameState,
        user: { id: 'user1' } as unknown as User,
        players: [{ user_id: 'user1', profiles: { username: 'User 1' } }] as unknown as Player[],
        input: '',
        setInput: vi.fn(),
        sending: false,
        solvingTimeLeft: 60,
        targetMessage: {
            id: 'msg1',
            content: 'Hello World',
            user_id: 'user2',
            hint_level: 0,
            guesses: [],
        } as unknown as Message,
        onSendMessage: vi.fn(),
        onGetHint: vi.fn(),
        onGiveUp: vi.fn(),
        isSinglePlayer: false,
    };

    afterEach(() => {
        stubPointer('absent');
    });

    it('focuses the field on a fine pointer so desktop players can just type', () => {
        stubPointer('fine');
        render(<GameInput {...props} />);

        expect(document.activeElement).toBe(screen.getByRole('textbox'));
    });

    it('leaves the field alone on touch, where focusing would open the keyboard', () => {
        stubPointer('coarse');
        render(<GameInput {...props} />);

        expect(document.activeElement).not.toBe(screen.getByRole('textbox'));
    });

    it('leaves the field alone when matchMedia is unavailable', () => {
        stubPointer('absent');
        render(<GameInput {...props} />);

        expect(document.activeElement).not.toBe(screen.getByRole('textbox'));
    });

    it('refocuses when the chain advances to the next word', () => {
        stubPointer('fine');
        const { rerender } = render(<GameInput {...props} />);

        screen.getByRole('textbox').blur();
        expect(document.activeElement).not.toBe(screen.getByRole('textbox'));

        rerender(
            <GameInput
                {...props}
                targetMessage={{ ...props.targetMessage, id: 'msg2' } as unknown as Message}
            />,
        );

        expect(document.activeElement).toBe(screen.getByRole('textbox'));
    });
});

describe('GameInput Character Counter', () => {
    const mockSetInput = vi.fn();
    const mockOnSendMessage = vi.fn();
    const mockOnGetHint = vi.fn();
    const mockOnGiveUp = vi.fn();

    const defaultProps = {
        game: {
            id: '1',
            status: 'solving',
            current_turn_user_id: 'user1',
        } as GameState,
        user: { id: 'user1' } as unknown as User,
        players: [{ user_id: 'user1', profiles: { username: 'User 1' } }] as unknown as Player[],
        input: '',
        setInput: mockSetInput,
        sending: false,
        solvingTimeLeft: 60,
        targetMessage: {
            id: 'msg1',
            content: 'Hello World', // 11 chars, 10 non-space
            user_id: 'user2',
            hint_level: 0,
            guesses: [],
        } as unknown as Message,
        onSendMessage: mockOnSendMessage,
        onGetHint: mockOnGetHint,
        onGiveUp: mockOnGiveUp,
        isSinglePlayer: false,
    };

    it('displays character count ignoring spaces for input', () => {
        render(<GameInput {...defaultProps} input="a b c" />); // 5 chars, 3 non-space

        const counter = screen.getByTestId('char-counter');
        expect(counter.textContent).toContain('3');

        // Should NOT show / 10 yet
        const fullCount = screen.queryByTestId('char-total');
        expect(fullCount).toBeNull();
    });

    it('displays target message count ignoring spaces when allowed', () => {
        const props = {
            ...defaultProps,
            isSinglePlayer: true,
            input: 'hello', // 5
        };

        render(<GameInput {...props} />);

        // Target 'Hello World' has 10 non-space characters.
        const counter = screen.getByTestId('char-counter');
        expect(counter.textContent).toContain('5');
        const total = screen.getByTestId('char-total');
        expect(total.textContent).toContain('/ 10');
    });

    it('displays target message count ignoring spaces when hint level >= 1', () => {
        const props = {
            ...defaultProps,
            targetMessage: {
                ...defaultProps.targetMessage,
                hint_level: 1,
            },
            input: 'test', // 4
        };

        render(<GameInput {...props} />);

        // Target 'Hello World' has 10 non-space characters.
        const counter = screen.getByTestId('char-counter');
        expect(counter.textContent).toContain('4');
        const total = screen.getByTestId('char-total');
        expect(total.textContent).toContain('/ 10');
    });

    it('turns red when input length exceeds target length (ignoring spaces)', () => {
        const props = {
            ...defaultProps,
            isSinglePlayer: true,
            input: 'hello world extra', // 17 chars, 15 non-space
        };

        render(<GameInput {...props} />);

        // 15 / 10
        const counterDiv = screen.getByTestId('char-counter');
        expect(counterDiv.textContent).toContain('15');
        expect(counterDiv.className).toContain('text-red-500');
    });

    it('ignores multiple spaces', () => {
        render(<GameInput {...defaultProps} input="  a  b  " />); // 2 non-space chars
        const counter = screen.getByTestId('char-counter');
        expect(counter.textContent).toContain('2');
    });

    it('calls onSendMessage when Enter is pressed', () => {
        render(<GameInput {...defaultProps} input="test message" />);
        const input = screen.getByRole('textbox');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });
        expect(mockOnSendMessage).toHaveBeenCalled();
    });
});
