import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IosTimePicker } from './time-picker';
import React from 'react';

// Mock scrollIntoView since jsdom doesn't implement it
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('IosTimePicker', () => {
    it('renders correctly with given range', () => {
        render(<IosTimePicker value={5} onChange={() => { }} min={0} max={10} />);
        expect(screen.getByText('5')).toBeDefined();
        // 0 is rendered as "Immediate" by default
        expect(screen.getByText('Immediate')).toBeDefined();
        expect(screen.getByText('10')).toBeDefined();
    });

    it('renders custom immediate label for 0', () => {
        render(<IosTimePicker value={0} onChange={() => { }} immediateLabel="Instant" />);
        expect(screen.getByText('Instant')).toBeDefined();
    });

    it('calls onChange when an item is clicked', () => {
        const handleChange = vi.fn();
        render(<IosTimePicker value={0} onChange={handleChange} min={0} max={5} />);

        const itemToClick = screen.getByText('3');
        fireEvent.click(itemToClick);

        expect(handleChange).toHaveBeenCalledWith(3);
    });

    it('highlights the selected value', () => {
        const { getByText } = render(<IosTimePicker value={2} onChange={() => { }} min={0} max={5} />);

        const selectedItem = getByText('2').closest('div');
        const unselectedItem = getByText('3').closest('div');

        expect(selectedItem?.className).toContain('font-bold');
        expect(unselectedItem?.className).toContain('text-gray-400');
    });
});
