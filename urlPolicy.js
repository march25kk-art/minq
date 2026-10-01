// Normalize common full-width and invisible-character variants before checking.
function containsUrl(value) {
  const text = String(value ?? "").normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[。．｡]/g, ".");
  return /(?:[a-z][a-z0-9+.-]*:\/\/|\b(?:https?|ftp):|\bwww\.|\/\/[^\s/]+\.|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]+)(?![a-z0-9-])|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|\b))/i.test(text);
}

const URL_ERROR_MESSAGE = "URLを含む投稿・コメントはできません。URLを削除してください。";

module.exports = { containsUrl, URL_ERROR_MESSAGE };
