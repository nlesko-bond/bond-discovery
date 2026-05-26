export const DOCUMENTATION_PREVIEW_MESSAGE_TYPE = 'bond-documentation-preview-html-change';
export const DOCUMENTATION_PREVIEW_SYNC_REQUEST_TYPE = 'bond-documentation-preview-sync-request';

const EDITABLE_PREVIEW_SCRIPT_ID = 'bond-documentation-editable-preview-script';
const EDITABLE_PREVIEW_BODY_ATTRIBUTE = 'data-bond-documentation-editable-preview';
const CLOSING_BODY_TAG_REGEX = /<\/body\s*>/i;

type DocumentationPreviewHtmlMessage = {
  type: typeof DOCUMENTATION_PREVIEW_MESSAGE_TYPE;
  sourceHtml: string;
  nonce: string;
};

export function buildTextEditableDocumentationPreviewHtml(sourceHtml: string, nonce: string): string {
  const bridgeScript = buildEditablePreviewBridgeScript(nonce);

  if (CLOSING_BODY_TAG_REGEX.test(sourceHtml)) {
    return sourceHtml.replace(CLOSING_BODY_TAG_REGEX, `${bridgeScript}</body>`);
  }

  return `${sourceHtml}${bridgeScript}`;
}

export function isDocumentationPreviewHtmlMessage(
  value: unknown,
  nonce: string,
): value is DocumentationPreviewHtmlMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    message.type === DOCUMENTATION_PREVIEW_MESSAGE_TYPE &&
    message.nonce === nonce &&
    typeof message.sourceHtml === 'string'
  );
}

function buildEditablePreviewBridgeScript(nonce: string): string {
  const scriptBody = `
(function () {
  var messageType = ${JSON.stringify(DOCUMENTATION_PREVIEW_MESSAGE_TYPE)};
  var syncRequestType = ${JSON.stringify(DOCUMENTATION_PREVIEW_SYNC_REQUEST_TYPE)};
  var scriptId = ${JSON.stringify(EDITABLE_PREVIEW_SCRIPT_ID)};
  var bodyAttribute = ${JSON.stringify(EDITABLE_PREVIEW_BODY_ATTRIBUTE)};
  var nonce = ${JSON.stringify(nonce)};

  function serializeDocument() {
    var clonedDocument = document.documentElement.cloneNode(true);
    var bridgeScript = clonedDocument.querySelector('#' + scriptId);
    if (bridgeScript) bridgeScript.remove();
    var clonedBody = clonedDocument.querySelector('body');
    if (clonedBody) {
      clonedBody.removeAttribute('contenteditable');
      clonedBody.removeAttribute('spellcheck');
      clonedBody.removeAttribute(bodyAttribute);
    }
    return '<!DOCTYPE html>\\n' + clonedDocument.outerHTML;
  }

  function sendUpdate() {
    parent.postMessage({
      type: messageType,
      nonce: nonce,
      sourceHtml: serializeDocument()
    }, '*');
  }

  function enableEditing() {
    if (!document.body) return;
    document.body.setAttribute('contenteditable', 'true');
    document.body.setAttribute('spellcheck', 'true');
    document.body.setAttribute(bodyAttribute, 'true');
    document.addEventListener('input', sendUpdate);
    document.addEventListener('focusout', sendUpdate);
    window.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== syncRequestType || event.data.nonce !== nonce) return;
      sendUpdate();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableEditing);
  } else {
    enableEditing();
  }
})();
`;

  return `<script id="${EDITABLE_PREVIEW_SCRIPT_ID}">${scriptBody}</script>`;
}
