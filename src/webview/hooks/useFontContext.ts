import { useEffect, useRef, useState, createContext, useContext } from 'react';

interface FontContextValue {
    fontCtx: CanvasRenderingContext2D | null;
    fontLoaded: boolean;
}

const FontCtxContext = createContext<FontContextValue>({ fontCtx: null, fontLoaded: false });

export function useFontContext(): FontContextValue {
    return useContext(FontCtxContext);
}

export { FontCtxContext };

/**
 * Hook to load the BoutiqueBitmap7x7 font and create a canvas context for glyph rendering.
 */
export function useFontLoader(fontUri: string): FontContextValue {
    const fontCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const [fontLoaded, setFontLoaded] = useState(false);

    useEffect(() => {
        const f = new FontFace('BoutiqueBitmap7x7', `url(${fontUri})`);
        f.load()
            .then((loaded) => {
                document.fonts.add(loaded);
                const canvas = document.createElement('canvas');
                canvas.width = 8;
                canvas.height = 8;
                fontCtxRef.current = canvas.getContext('2d', { willReadFrequently: true });
                setFontLoaded(true);
            })
            .catch(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 8;
                canvas.height = 8;
                fontCtxRef.current = canvas.getContext('2d', { willReadFrequently: true });
                setFontLoaded(true);
            });
    }, [fontUri]);

    return { fontCtx: fontCtxRef.current, fontLoaded };
}
