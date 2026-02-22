import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ExportPreview } from '../components/export/ExportPreview';

describe('ExportPreview', () => {
    it('renders a canvas with expected dimensions', () => {
        const { container } = render(
            <ExportPreview
                template="default"
                title="Test Game"
                author="Test Author"
                templatePreviews={{}}
                labelDataUrl={null}
                fontLoaded={false}
            />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeTruthy();
        expect(canvas!.width).toBe(160);
        expect(canvas!.height).toBe(205);
    });

    it('is wrapped in .export-preview container', () => {
        const { container } = render(
            <ExportPreview
                template="default"
                title=""
                author=""
                templatePreviews={{}}
                labelDataUrl={null}
                fontLoaded={false}
            />
        );

        const wrapper = container.querySelector('.export-preview');
        expect(wrapper).toBeTruthy();
    });
});
