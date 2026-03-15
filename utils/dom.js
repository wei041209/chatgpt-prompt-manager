/**
 * DOM helpers for ChatGPT input and sidebar injection
 */

const SIDEBAR_ID = 'pm-sidebar-root';

// Selectors in priority order: textarea first, then contenteditable, then fallbacks
const CHATGPT_INPUT_SELECTORS = [
  'textarea[data-id]',
  'textarea[data-id="root"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  'form textarea',
  'textarea'
];

function isElementVisible(el) {
  if (!el) return false;
  try {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (el.offsetParent !== null || el.isConnected);
  } catch (_) {
    return false;
  }
}

function findChatGPTInput() {
  for (const sel of CHATGPT_INPUT_SELECTORS) {
    try {
      const el = document.querySelector(sel);
      if (el && isElementVisible(el)) {
        return el;
      }
    } catch (_) { }
  }
  return null;
}

/**
 * Appends prompt text to the ChatGPT input (textarea or contenteditable).
 * - If input is empty: insert prompt directly.
 * - If input has content: append with exactly two newlines before the prompt.
 */
function insertTextIntoInput(inputEl, text) {
  if (!inputEl || !text) return false;
  try {
    inputEl.focus();

    const isContentEditable = inputEl.isContentEditable || inputEl.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();

      const currentText = (inputEl.innerText || inputEl.textContent || "").trim();
      let textNode;

      if (currentText === "") {
        range.selectNodeContents(inputEl);
        range.deleteContents();
        textNode = document.createTextNode(text);
        range.insertNode(textNode);
      } else {
        range.selectNodeContents(inputEl);
        range.collapse(false);
        textNode = document.createTextNode("\n\n" + text);
        range.insertNode(textNode);
      }

      range.setStartAfter(textNode);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);

      inputEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    } else {
      const current = inputEl.value || "";
      const trimmed = current.trim();

      if (trimmed === "") {
        inputEl.value = text;
      } else {
        inputEl.value = current + "\n\n" + text;
      }

      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  } catch (err) {
    console.warn('[Prompt Manager] insertTextIntoInput error:', err);
    return false;
  }
}

function sidebarExists() {
  return !!document.getElementById(SIDEBAR_ID);
}

function createSidebarRoot() {
  if (sidebarExists()) return document.getElementById(SIDEBAR_ID);
  const root = document.createElement('div');
  root.id = SIDEBAR_ID;
  document.body.appendChild(root);
  return root;
}
