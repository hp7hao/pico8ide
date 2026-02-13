import { useCartStore } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import type { LocaleStrings } from '../../types';

interface SpriteStatusBarProps {
    locale: LocaleStrings;
    mouseX: number;
    mouseY: number;
}

export function SpriteStatusBar({ locale, mouseX, mouseY }: SpriteStatusBarProps) {
    const fgColor = useUIStore((s) => s.spriteFgColor);
    const bgColor = useUIStore((s) => s.spriteBgColor);
    const flags = useCartStore((s) => s.flags);

    let text = '';
    if (mouseX >= 0 && mouseX < 128 && mouseY >= 0 && mouseY < 128) {
        const sprNum = Math.floor(mouseY / 8) * 16 + Math.floor(mouseX / 8);
        const flagByte = flags[sprNum] || 0;
        const flagList: number[] = [];
        for (let fi = 0; fi < 8; fi++) {
            if (flagByte & (1 << fi)) flagList.push(fi);
        }
        const flagStr = flagList.length > 0 ? ('  ' + locale.flagsLabel + ': ' + flagList.join(',')) : '';
        text = `${locale.position}: (${mouseX}, ${mouseY})  ${locale.spriteLabel}: #${sprNum}  ${locale.foreground}:${fgColor} ${locale.background}:${bgColor}${flagStr}`;
    }

    return <div className="sprite-statusbar">{text}</div>;
}
