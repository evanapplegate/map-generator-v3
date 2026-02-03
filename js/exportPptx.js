import { log } from './logger.js';

/**
 * Export map as PPTX
 * @param {HTMLElement} container - The container element containing the SVG map
 * @param {string} filename - The filename for the exported PPTX
 */
export async function exportPptx(container, filename = 'map.pptx') {
    log('PPTX', 'Starting PPTX export');
    
    try {
        const originalSvg = container.querySelector('svg');
        if (!originalSvg) {
            throw new Error('No SVG found in container');
        }

        // Clone SVG to manipulate it without affecting the display
        const svg = originalSvg.cloneNode(true);

        // Update default fills for PPTX (#edded1 -> #DBD3CC)
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
            const currentFill = path.getAttribute('fill');
            if (currentFill && currentFill.toLowerCase() === '#edded1') {
                path.setAttribute('fill', '#DBD3CC');
            }
            // Update stroke width for export
            const currentStrokeWidth = path.getAttribute('stroke-width');
            if (currentStrokeWidth && currentStrokeWidth === '1') {
                path.setAttribute('stroke-width', '0.5');
            }
        });
        
        // Get SVG dimensions and viewBox
        const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
        const vbX = viewBox[0];
        const vbY = viewBox[1];
        const vbW = viewBox[2];
        const vbH = viewBox[3];
        
        // Slide dimensions in inches
        const slideWidth = 10;
        const slideHeight = 5.625;
        
        // Extract text elements
        const textElements = [];
        const texts = svg.querySelectorAll('text');
        
        texts.forEach(textNode => {
            // Get attributes
            const x = parseFloat(textNode.getAttribute('x') || 0);
            const y = parseFloat(textNode.getAttribute('y') || 0);
            const textAnchor = textNode.getAttribute('text-anchor') || 'start';
            const fontSizeStr = textNode.getAttribute('font-size') || '10pt';
            const fontFamily = textNode.getAttribute('font-family') || 'Arial';
            const fill = textNode.getAttribute('fill') || '#000000';
            const fontWeight = textNode.style.fontWeight || 'normal';
            const content = textNode.textContent;
            const display = textNode.style.display;

            // Skip hidden text
            if (display === 'none' || !content) return;

            // Parse font size (assume pt if not specified, or px)
            // Override user preference to enforce 6pt for PPTX
            let fontSize = 6;
            
            let posIdx = null;
            if (textNode.hasAttribute('data-pos-idx')) {
                const val = textNode.getAttribute('data-pos-idx');
                if (val !== null && val !== '' && val !== 'undefined') {
                    posIdx = parseInt(val, 10);
                }
            }
            
            textElements.push({
                text: content,
                x,
                y,
                textAnchor,
                fontSize,
                fontFamily,
                color: fill,
                bold: fontWeight === 'bold',
                posIdx
            });
            
            // Remove text from SVG
            textNode.remove();
        });

        // Serialize the text-free SVG
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;

        // Create PPTX
        const pres = new PptxGenJS();
        const slide = pres.addSlide();
        
        // Add grey ribbon at the top
        const ribbonHeight = 0.3 * 1.3; // Increase height by 30%
        slide.addShape(pres.ShapeType.rect, {
            x: 0,
            y: 0,
            w: slideWidth,
            h: ribbonHeight,
            fill: { color: 'EFEFEF' } // Light grey
        });

        // Add "Your Map" text on the ribbon
        // Move label down 5px from original (was 10px, now moved up 5px)
        slide.addText('Right click your map > “Convert to Shape” to edit it further', {
            x: 0.2,
            y: 0.05 + (5 / 72),
            w: 8,
            h: 0.2,
            fontSize: 10,
            fontFace: 'Optima',
            color: '333333',
            bold: true,
            align: 'left',
            valign: 'middle'
        });
        
        // Add SVG image (now without text)
        // Cap total map height to 80% of slide
        const maxMapHeight = slideHeight * 0.9;
        const scale = Math.min(slideWidth / vbW, maxMapHeight / vbH);
        
        // Calculate offset to center the map
        const offsetX = (slideWidth - (vbW * scale)) / 2;
        const offsetY = ((slideHeight - (vbH * scale)) / 2) + 0.15; // Shift down slightly for ribbon

        slide.addImage({
            data: svgBase64,
            x: offsetX,
            y: offsetY,
            w: vbW * scale,
            h: vbH * scale
        });

        // Add text boxes
        textElements.forEach(item => {
            // Map alignment
            let align = 'left';
            if (item.textAnchor === 'middle') align = 'center';
            if (item.textAnchor === 'end') align = 'right';
            
            // PPTX text boxes have internal padding that pushes text away from the edge.
            // We need to aggressively pull them back towards the marker.
            // 1 pt = 1/72 inch.
            const fontSizeInches = item.fontSize / 72;
            
            // Calculate PPTX coordinates
            const pptxX = ((item.x - vbX) * scale) + offsetX;
            const pptxY = ((item.y - vbY) * scale) + offsetY;
            
            // Aggressive adjustments to force labels closer to markers in PPTX
            let boxX = pptxX;
            let adjustedY = pptxY;

            // Estimate text width in inches (approx 0.6 of font size per char for Optima)
            const estimatedWidth = (item.text.length * item.fontSize * 0.6) / 72;
            const boxW = estimatedWidth;

            // Determine "visual" alignment relative to marker based on D3 position index
            // 0, 2, 5: Label is to the Right of marker (Standard)
            // 1, 3, 6: Label is to the Left of marker
            // 4, 7: Label is Centered
            
            if (item.posIdx !== null && !isNaN(item.posIdx)) {
                const isRightSideLabel = [0, 2, 5].includes(item.posIdx);
                const isLeftSideLabel = [1, 3, 6].includes(item.posIdx);

                if (isRightSideLabel) {
                    // Label is to the RIGHT of marker.
                    // Text starts near marker.
                    // Pull Left (Decrease X) to move closer to marker.
                    boxX = pptxX - 0.2; 
                    
                    // SVG baseline is at bottom, PPTX top is at top. Shift up to align.
                    adjustedY = pptxY - (fontSizeInches * 0.8);
                } else if (isLeftSideLabel) {
                    // Label is to the LEFT of marker.
                    // Text starts far left. Text ENDs near marker.
                    // Pull Right (Increase X) to move closer to marker.
                    boxX = pptxX + 0.2; 
                    
                    adjustedY = pptxY - (fontSizeInches * 0.8);
                } else {
                    // Center aligned (above/below)
                    boxX = pptxX;
                    adjustedY = pptxY - (fontSizeInches * 0.5);
                }
            } else {
                // State/Country label (no posIdx)
                // Use default positioning based on text-anchor
                if (align === 'center') {
                    boxX = pptxX - (boxW / 2);
                } else if (align === 'right') {
                    boxX = pptxX - boxW;
                } else {
                    boxX = pptxX;
                }
                
                // Standard baseline adjustment for labels without D3 collision data
                adjustedY = pptxY - (fontSizeInches * 0.75);
            }

            slide.addText(item.text, {
                x: boxX,
                y: adjustedY,
                w: boxW + 0.2, // Extra width to prevent premature wrapping due to padding
                h: fontSizeInches * 1.5,
                fontSize: item.fontSize,
                fontFace: 'Optima',
                color: item.color.replace('#', ''),
                bold: item.bold,
                align: align,
                valign: 'top',
                margin: 0,
                wrap: false
            });
        });

        // Save
        await pres.writeFile({ fileName: filename });
        
        log('PPTX', 'PPTX export complete');
        
    } catch (error) {
        log('PPTX', 'Error exporting PPTX', { error });
        throw error;
    }
}
