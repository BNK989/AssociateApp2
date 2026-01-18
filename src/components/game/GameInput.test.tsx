import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GameInput } from './GameInput';
import { GameState } from '@/hooks/useGameLogic';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Send: () => <div data-testid="send-icon" />,
    Loader2: () => <div data-testid="loader-icon" />,
    Shuffle: () => <div data-testid="shuffle-icon" />,
    Pause: () => <div data-testid="pause-icon" />,
    Play: () => <div data-testid="play-icon" />,
    Settings: () => <div data-testid="settings-icon" />,
    Flag: () => <div data-testid="flag-icon" />,
    Clock: () => <div data-testid="clock-icon" />,
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        button: ({ children, onClick, disabled }: any) => (
            <button onClick={onClick} disabled={disabled}>{children}</button>
        ),
        div: ({ children, className }: any) => <div className={className}>{children}</div>,
        rect: ({ className }: any) => <rect className={className} />,
    },
    AnimatePresence: ({ children }: any) => <div>{children}</div>,
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
    },
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
    DropdownMenu: ({ children }: any) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
}));

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
        user: { id: 'user1' } as any,
        players: [{ user_id: 'user1', profiles: { username: 'User 1' } }] as any[],
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
        } as any,
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
        } as any;

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
});
