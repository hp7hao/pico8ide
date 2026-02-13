import { useRef, useEffect, useCallback } from 'react';

interface ExportPreviewProps {
    template: string;
    title: string;
    author: string;
    templatePreviews: Record<string, string>;
    labelDataUrl: string | null;
    fontLoaded: boolean;
}

export function ExportPreview({
    template,
    title,
    author,
    templatePreviews,
    labelDataUrl,
    fontLoaded,
}: ExportPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const drawText = useCallback(
        (ctx: CanvasRenderingContext2D) => {
            if (!fontLoaded) return;
            ctx.font = '8px BoutiqueBitmap7x7';
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'top';

            // Render title at (18, 166)
            let tx = 18;
            for (let i = 0; i < title.length; i++) {
                const ch = title[i];
                const isA = ch.charCodeAt(0) < 128;
                ctx.fillText(ch, tx, 166);
                tx += isA ? 4 : 8;
            }

            // Render author at (18, 176)
            let ax = 18;
            for (let j = 0; j < author.length; j++) {
                const ch = author[j];
                const isA = ch.charCodeAt(0) < 128;
                ctx.fillText(ch, ax, 176);
                ax += isA ? 4 : 8;
            }
        },
        [title, author, fontLoaded]
    );

    const renderPreview = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 160, 205);

        const templateSrc = templatePreviews[template];
        if (templateSrc) {
            const tplImg = new Image();
            tplImg.onload = () => {
                ctx.drawImage(tplImg, 0, 0, 160, 205);
                if (labelDataUrl) {
                    const labelImg = new Image();
                    labelImg.onload = () => {
                        ctx.drawImage(labelImg, 16, 24, 128, 128);
                        drawText(ctx);
                    };
                    labelImg.src = labelDataUrl;
                } else {
                    drawText(ctx);
                }
            };
            tplImg.src = templateSrc;
        }
    }, [template, templatePreviews, labelDataUrl, drawText]);

    useEffect(() => {
        renderPreview();
    }, [renderPreview]);

    return (
        <div className="export-preview">
            <canvas ref={canvasRef} width={160} height={205} />
        </div>
    );
}
