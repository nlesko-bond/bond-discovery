import { describe, expect, it } from 'vitest';
import {
  buildTextEditableDocumentationPreviewHtml,
  DOCUMENTATION_PREVIEW_MESSAGE_TYPE,
  DOCUMENTATION_PREVIEW_SYNC_REQUEST_TYPE,
  isDocumentationPreviewHtmlMessage,
} from '@/lib/documentation-preview-edit';

const PREVIEW_NONCE = 'preview-nonce';

describe('documentation preview editing', () => {
  it('injects a text-editing bridge before the closing body tag', () => {
    const html = '<!DOCTYPE html><html><body><h1>Docs</h1></body></html>';

    const editableHtml = buildTextEditableDocumentationPreviewHtml(html, PREVIEW_NONCE);

    expect(editableHtml).toContain('<h1>Docs</h1>');
    expect(editableHtml).toContain('bond-documentation-editable-preview-script');
    expect(editableHtml).toContain(DOCUMENTATION_PREVIEW_MESSAGE_TYPE);
    expect(editableHtml).toContain(DOCUMENTATION_PREVIEW_SYNC_REQUEST_TYPE);
    expect(editableHtml).toContain(PREVIEW_NONCE);
    expect(editableHtml.indexOf('bond-documentation-editable-preview-script')).toBeLessThan(
      editableHtml.indexOf('</body>'),
    );
  });

  it('appends the bridge when source html has no body tag', () => {
    const editableHtml = buildTextEditableDocumentationPreviewHtml('<h1>Docs</h1>', PREVIEW_NONCE);

    expect(editableHtml).toContain('<h1>Docs</h1>');
    expect(editableHtml).toContain('bond-documentation-editable-preview-script');
  });

  it('identifies preview html update messages', () => {
    expect(
      isDocumentationPreviewHtmlMessage({
        type: DOCUMENTATION_PREVIEW_MESSAGE_TYPE,
        nonce: PREVIEW_NONCE,
        sourceHtml: '<html></html>',
      }, PREVIEW_NONCE),
    ).toBe(true);

    expect(
      isDocumentationPreviewHtmlMessage({
        type: DOCUMENTATION_PREVIEW_MESSAGE_TYPE,
        nonce: PREVIEW_NONCE,
        sourceHtml: null,
      }, PREVIEW_NONCE),
    ).toBe(false);
    expect(
      isDocumentationPreviewHtmlMessage({
        type: DOCUMENTATION_PREVIEW_MESSAGE_TYPE,
        nonce: 'other',
        sourceHtml: '<html></html>',
      }, PREVIEW_NONCE),
    ).toBe(false);
    expect(isDocumentationPreviewHtmlMessage({ type: 'other', sourceHtml: '<html></html>' }, PREVIEW_NONCE)).toBe(false);
  });
});
