/**
 * Safe clipboard copy utility.
 * navigator.clipboard is blocked on non-secure origins (plain http://IP).
 * This provides an automatic fallback using document.execCommand('copy').
 */
export const copyToClipboardSafe = async (text) => {
  if (!text) return false;

  // Modern Async Clipboard API (works on localhost and HTTPS)
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fall through to legacy fallback
    }
  }

  // Fallback for plain HTTP / remote IP environments
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
};
