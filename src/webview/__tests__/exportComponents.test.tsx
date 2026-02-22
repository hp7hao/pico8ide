import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplatePicker } from '../components/export/TemplatePicker';
import { createMockInitData } from '../standalone/mockInitData';
import type { LocaleStrings } from '../types';

const locale: LocaleStrings = createMockInitData().locale;

describe('TemplatePicker', () => {
    it('renders 4 template options', () => {
        const { container } = render(
            <TemplatePicker
                locale={locale}
                selected="default"
                templatePreviews={{}}
                onSelect={vi.fn()}
            />
        );
        const options = container.querySelectorAll('.template-option');
        expect(options).toHaveLength(4);
    });

    it('displays template names', () => {
        render(
            <TemplatePicker
                locale={locale}
                selected="default"
                templatePreviews={{}}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByText('default')).toBeDefined();
        expect(screen.getByText('cyan')).toBeDefined();
        expect(screen.getByText('e-zombie')).toBeDefined();
        expect(screen.getByText('e-zombie16')).toBeDefined();
    });

    it('marks selected template with "selected" class', () => {
        const { container } = render(
            <TemplatePicker
                locale={locale}
                selected="cyan"
                templatePreviews={{}}
                onSelect={vi.fn()}
            />
        );
        const options = container.querySelectorAll('.template-option');
        const cyanOption = Array.from(options).find(
            (o) => o.textContent?.includes('cyan') && !o.textContent?.includes('e-zombie')
        );
        expect(cyanOption?.className).toContain('selected');
    });

    it('calls onSelect when clicking a template', () => {
        const onSelect = vi.fn();
        render(
            <TemplatePicker
                locale={locale}
                selected="default"
                templatePreviews={{}}
                onSelect={onSelect}
            />
        );
        fireEvent.click(screen.getByText('e-zombie'));
        expect(onSelect).toHaveBeenCalledWith('e-zombie');
    });

    it('renders preview images when provided', () => {
        const { container } = render(
            <TemplatePicker
                locale={locale}
                selected="default"
                templatePreviews={{ default: 'data:image/png;base64,abc' }}
                onSelect={vi.fn()}
            />
        );
        const img = container.querySelector('img');
        expect(img?.getAttribute('src')).toBe('data:image/png;base64,abc');
    });

    it('shows label text from locale', () => {
        render(
            <TemplatePicker
                locale={locale}
                selected="default"
                templatePreviews={{}}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByText('Template')).toBeDefined();
    });
});
