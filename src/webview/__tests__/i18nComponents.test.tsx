import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nStatusBar } from '../components/i18n/I18nStatusBar';
import { TranslationTable } from '../components/i18n/TranslationTable';
import type { I18nData } from '../types';

describe('I18nStatusBar', () => {
    it('shows key count, locale count, and completion percentage', () => {
        const i18nData: I18nData = {
            locales: ['en', 'zh_CN'],
            entries: [
                { key: 'hello', translations: { en: 'Hello', zh_CN: '你好' } },
                { key: 'bye', translations: { en: 'Bye' } },
            ],
        };
        render(<I18nStatusBar i18nData={i18nData} />);
        // 2 keys, 2 locales, 3/4 filled = 75%
        expect(screen.getByText(/2 keys/)).toBeDefined();
        expect(screen.getByText(/2 locales/)).toBeDefined();
        expect(screen.getByText(/3\/4/)).toBeDefined();
        expect(screen.getByText(/75%/)).toBeDefined();
    });

    it('shows 100% when all translations are present', () => {
        const i18nData: I18nData = {
            locales: ['en'],
            entries: [
                { key: 'hello', translations: { en: 'Hello' } },
            ],
        };
        render(<I18nStatusBar i18nData={i18nData} />);
        expect(screen.getByText(/1\/1/)).toBeDefined();
        expect(screen.getByText(/100%/)).toBeDefined();
    });

    it('shows 0% when no translations are present', () => {
        const i18nData: I18nData = {
            locales: ['en', 'fr'],
            entries: [
                { key: 'hello', translations: {} },
            ],
        };
        render(<I18nStatusBar i18nData={i18nData} />);
        expect(screen.getByText(/0\/2/)).toBeDefined();
        expect(screen.getByText(/0%/)).toBeDefined();
    });

    it('handles empty entries', () => {
        const i18nData: I18nData = {
            locales: [],
            entries: [],
        };
        render(<I18nStatusBar i18nData={i18nData} />);
        expect(screen.getByText(/0 keys/)).toBeDefined();
        expect(screen.getByText(/0 locales/)).toBeDefined();
        expect(screen.getByText(/0%/)).toBeDefined();
    });
});

describe('TranslationTable', () => {
    it('renders empty state when no entries and no locales', () => {
        const i18nData: I18nData = { locales: [], entries: [] };
        render(<TranslationTable i18nData={i18nData} onTranslationChange={vi.fn()} />);
        expect(screen.getByText(/No i18n entries yet/)).toBeDefined();
    });

    it('renders table headers with locale names', () => {
        const i18nData: I18nData = {
            locales: ['en', 'zh_CN'],
            entries: [{ key: 'hello', translations: { en: 'Hello' } }],
        };
        render(<TranslationTable i18nData={i18nData} onTranslationChange={vi.fn()} />);
        expect(screen.getByText('Key')).toBeDefined();
        expect(screen.getByText('en')).toBeDefined();
        expect(screen.getByText('zh_CN')).toBeDefined();
    });

    it('renders entry keys in first column', () => {
        const i18nData: I18nData = {
            locales: ['en'],
            entries: [
                { key: 'greeting', translations: { en: 'Hi' } },
                { key: 'farewell', translations: { en: 'Bye' } },
            ],
        };
        render(<TranslationTable i18nData={i18nData} onTranslationChange={vi.fn()} />);
        expect(screen.getByText('greeting')).toBeDefined();
        expect(screen.getByText('farewell')).toBeDefined();
    });

    it('renders input fields with translation values', () => {
        const i18nData: I18nData = {
            locales: ['en'],
            entries: [{ key: 'hello', translations: { en: 'Hello World' } }],
        };
        render(<TranslationTable i18nData={i18nData} onTranslationChange={vi.fn()} />);
        const input = screen.getByDisplayValue('Hello World');
        expect(input).toBeDefined();
    });

    it('calls onTranslationChange when input changes', () => {
        const onChange = vi.fn();
        const i18nData: I18nData = {
            locales: ['en'],
            entries: [{ key: 'hello', translations: { en: '' } }],
        };
        render(<TranslationTable i18nData={i18nData} onTranslationChange={onChange} />);
        const inputs = document.querySelectorAll('.i18n-trans-input');
        fireEvent.change(inputs[0], { target: { value: 'Hi' } });
        expect(onChange).toHaveBeenCalledWith(0, 'en', 'Hi');
    });

    it('adds "empty" class to inputs with no translation', () => {
        const i18nData: I18nData = {
            locales: ['en'],
            entries: [{ key: 'hello', translations: {} }],
        };
        render(<TranslationTable i18nData={i18nData} onTranslationChange={vi.fn()} />);
        const input = document.querySelector('.i18n-trans-input');
        expect(input?.className).toContain('empty');
    });
});
