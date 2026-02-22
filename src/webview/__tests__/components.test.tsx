import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '../store/uiStore';
import { useCartStore } from '../store/cartStore';
import { createMockInitData } from '../standalone/mockInitData';
import { bridge } from '../bridge';
import type { LocaleStrings } from '../types';

const locale: LocaleStrings = createMockInitData().locale;

// ---------- TabBar ----------
import { TabBar } from '../components/TabBar';

describe('TabBar', () => {
    beforeEach(() => {
        useUIStore.setState({ editable: true, showRunButton: true, pico8Running: false });
    });

    it('renders all 7 tabs when editable', () => {
        render(<TabBar locale={locale} />);
        expect(screen.getByText('Code')).toBeDefined();
        expect(screen.getByText('Sprites')).toBeDefined();
        expect(screen.getByText('Map')).toBeDefined();
        expect(screen.getByText('SFX')).toBeDefined();
        expect(screen.getByText('Music')).toBeDefined();
        expect(screen.getByText('I18n')).toBeDefined();
        expect(screen.getByText('Export')).toBeDefined();
    });

    it('hides I18n and Export tabs when not editable', () => {
        useUIStore.setState({ editable: false });
        render(<TabBar locale={locale} />);
        expect(screen.queryByText('I18n')).toBeNull();
        expect(screen.queryByText('Export')).toBeNull();
        // Other tabs still visible
        expect(screen.getByText('Code')).toBeDefined();
    });

    it('marks active tab with "active" class', () => {
        useUIStore.setState({ activeTab: 'sprites' });
        render(<TabBar locale={locale} />);
        const spritesTab = screen.getByText('Sprites');
        expect(spritesTab.className).toContain('active');
        const codeTab = screen.getByText('Code');
        expect(codeTab.className).not.toContain('active');
    });

    it('clicking a tab changes activeTab in store', () => {
        render(<TabBar locale={locale} />);
        fireEvent.click(screen.getByText('Map'));
        expect(useUIStore.getState().activeTab).toBe('map');
    });

    it('shows run button when showRunButton is true', () => {
        render(<TabBar locale={locale} />);
        expect(screen.getByText(/Run/)).toBeDefined();
    });

    it('run button sends "run" message via bridge', () => {
        vi.spyOn(bridge, 'postMessage');
        render(<TabBar locale={locale} />);
        fireEvent.click(screen.getByText(/Run/));
        expect(bridge.postMessage).toHaveBeenCalledWith({ type: 'run' });
        vi.restoreAllMocks();
    });

    it('stop button sends "stop" message when running', () => {
        useUIStore.setState({ pico8Running: true });
        vi.spyOn(bridge, 'postMessage');
        render(<TabBar locale={locale} />);
        fireEvent.click(screen.getByText(/Stop/));
        expect(bridge.postMessage).toHaveBeenCalledWith({ type: 'stop' });
        vi.restoreAllMocks();
    });

    it('hides run button when showRunButton is false', () => {
        useUIStore.setState({ showRunButton: false });
        render(<TabBar locale={locale} />);
        expect(screen.queryByText(/Run/)).toBeNull();
    });
});

// ---------- SpriteStatusBar ----------
import { SpriteStatusBar } from '../components/sprites/SpriteStatusBar';

describe('SpriteStatusBar', () => {
    it('displays position and sprite info for valid coordinates', () => {
        render(<SpriteStatusBar locale={locale} mouseX={16} mouseY={8} />);
        // mouseX=16, mouseY=8 => sprNum = floor(8/8)*16 + floor(16/8) = 1*16+2 = 18
        expect(screen.getByText(/Sprite: #18/)).toBeDefined();
        expect(screen.getByText(/Pos: \(16, 8\)/)).toBeDefined();
    });

    it('shows nothing for coordinates out of range', () => {
        const { container } = render(<SpriteStatusBar locale={locale} mouseX={-1} mouseY={0} />);
        expect(container.querySelector('.sprite-statusbar')?.textContent).toBe('');
    });

    it('includes flag info when sprite has flags set', () => {
        // Set flag bits 0 and 2 for sprite 0
        const flags = new Array(256).fill(0);
        flags[0] = 0b00000101; // flags 0 and 2
        useCartStore.setState({ flags });

        render(<SpriteStatusBar locale={locale} mouseX={0} mouseY={0} />);
        expect(screen.getByText(/Flags: 0,2/)).toBeDefined();
    });
});

// ---------- MusicStatusBar ----------
import { MusicStatusBar } from '../components/music/MusicStatusBar';

describe('MusicStatusBar', () => {
    it('displays pattern number when not playing', () => {
        render(
            <MusicStatusBar
                patternIndex={5}
                playingPattern={0}
                isPlaying={false}
                playingPatternLabel="Playing Pattern"
            />
        );
        expect(screen.getByText('Pattern 05')).toBeDefined();
    });

    it('displays playing pattern label when playing', () => {
        render(
            <MusicStatusBar
                patternIndex={5}
                playingPattern={12}
                isPlaying={true}
                playingPatternLabel="Playing Pattern"
            />
        );
        expect(screen.getByText('Playing Pattern 12')).toBeDefined();
    });

    it('pads pattern number to 2 digits', () => {
        render(
            <MusicStatusBar
                patternIndex={0}
                playingPattern={0}
                isPlaying={false}
                playingPatternLabel="Playing"
            />
        );
        expect(screen.getByText('Pattern 00')).toBeDefined();
    });
});

// ---------- MusicToolbar ----------
import { MusicToolbar } from '../components/music/MusicToolbar';

describe('MusicToolbar', () => {
    it('shows pattern number padded to 2 digits', () => {
        render(
            <MusicToolbar
                locale={locale}
                patternIndex={3}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                showAudio={false}
                isPlaying={false}
                onTogglePlay={vi.fn()}
                editable={false}
                onClear={vi.fn()}
            />
        );
        expect(screen.getByText('03')).toBeDefined();
    });

    it('calls onPrev and onNext when arrows clicked', () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        render(
            <MusicToolbar
                locale={locale}
                patternIndex={10}
                onPrev={onPrev}
                onNext={onNext}
                showAudio={false}
                isPlaying={false}
                onTogglePlay={vi.fn()}
                editable={false}
                onClear={vi.fn()}
            />
        );
        fireEvent.click(screen.getByText('\u25c0'));
        expect(onPrev).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText('\u25b6'));
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('shows play button when showAudio is true', () => {
        render(
            <MusicToolbar
                locale={locale}
                patternIndex={0}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                showAudio={true}
                isPlaying={false}
                onTogglePlay={vi.fn()}
                editable={false}
                onClear={vi.fn()}
            />
        );
        expect(screen.getByText(/Play/)).toBeDefined();
    });

    it('shows stop text when playing', () => {
        render(
            <MusicToolbar
                locale={locale}
                patternIndex={0}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                showAudio={true}
                isPlaying={true}
                onTogglePlay={vi.fn()}
                editable={false}
                onClear={vi.fn()}
            />
        );
        expect(screen.getByText(/Stop/)).toBeDefined();
    });

    it('shows CLR button only when editable', () => {
        const { rerender } = render(
            <MusicToolbar
                locale={locale}
                patternIndex={0}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                showAudio={false}
                isPlaying={false}
                onTogglePlay={vi.fn()}
                editable={false}
                onClear={vi.fn()}
            />
        );
        expect(screen.queryByText('CLR')).toBeNull();

        rerender(
            <MusicToolbar
                locale={locale}
                patternIndex={0}
                onPrev={vi.fn()}
                onNext={vi.fn()}
                showAudio={false}
                isPlaying={false}
                onTogglePlay={vi.fn()}
                editable={true}
                onClear={vi.fn()}
            />
        );
        expect(screen.getByText('CLR')).toBeDefined();
    });
});

// ---------- PatternNavigator ----------
import { PatternNavigator } from '../components/music/PatternNavigator';

describe('PatternNavigator', () => {
    it('renders 64 pattern cells', () => {
        const music = new Array(256).fill(0x40);
        const { container } = render(
            <PatternNavigator
                music={music}
                currentPattern={0}
                playingPattern={-1}
                isPlaying={false}
                onSelectPattern={vi.fn()}
            />
        );
        const cells = container.querySelectorAll('.music-nav-cell');
        expect(cells).toHaveLength(64);
    });

    it('marks selected pattern with "selected" class', () => {
        const music = new Array(256).fill(0x40);
        const { container } = render(
            <PatternNavigator
                music={music}
                currentPattern={5}
                playingPattern={-1}
                isPlaying={false}
                onSelectPattern={vi.fn()}
            />
        );
        const cell5 = container.querySelectorAll('.music-nav-cell')[5];
        expect(cell5.className).toContain('selected');
    });

    it('marks non-empty patterns', () => {
        const music = new Array(256).fill(0x40);
        // Make pattern 0 non-empty: enable channel 0
        music[0] = 0; // sfx 0, enabled (bit 6 = 0)
        const { container } = render(
            <PatternNavigator
                music={music}
                currentPattern={0}
                playingPattern={-1}
                isPlaying={false}
                onSelectPattern={vi.fn()}
            />
        );
        const cell0 = container.querySelectorAll('.music-nav-cell')[0];
        expect(cell0.className).toContain('non-empty');
    });

    it('calls onSelectPattern on click', () => {
        const music = new Array(256).fill(0x40);
        const onSelect = vi.fn();
        const { container } = render(
            <PatternNavigator
                music={music}
                currentPattern={0}
                playingPattern={-1}
                isPlaying={false}
                onSelectPattern={onSelect}
            />
        );
        const cell10 = container.querySelectorAll('.music-nav-cell')[10];
        fireEvent.click(cell10);
        expect(onSelect).toHaveBeenCalledWith(10);
    });

    it('marks playing pattern with "playing" class', () => {
        const music = new Array(256).fill(0x40);
        const { container } = render(
            <PatternNavigator
                music={music}
                currentPattern={0}
                playingPattern={3}
                isPlaying={true}
                onSelectPattern={vi.fn()}
            />
        );
        const cell3 = container.querySelectorAll('.music-nav-cell')[3];
        expect(cell3.className).toContain('playing');
    });
});
