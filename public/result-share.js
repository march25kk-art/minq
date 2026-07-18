"use strict";

(() => {
  const SVG = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"/></svg>'
  };

  const cleanUrl = () => `${location.origin}${location.pathname}`;

  function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    return Promise.resolve();
  }

  function close(dialog) {
    if (dialog?.open) dialog.close();
    dialog?.remove();
  }

  function showFeedback(dialog, message) {
    const node = dialog.querySelector(".diagnosis-share-feedback");
    node.textContent = message;
  }

  function open(payload) {
    document.querySelector(".diagnosis-share-dialog")?.remove();
    const url = payload.url || cleanUrl();
    const text = payload.text || `${payload.diagnosis}で「${payload.result}」でした！`;
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const dialog = document.createElement("dialog");
    dialog.className = "diagnosis-share-dialog";
    dialog.innerHTML = `
      <div class="diagnosis-share-head">
        <div><b>診断結果をシェア</b><span>共有先を選んでください</span></div>
        <button class="diagnosis-share-close" type="button" aria-label="閉じる">${SVG.close}</button>
      </div>
      <div class="diagnosis-share-destination">
        <a class="diagnosis-share-service share-x" href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="Xでシェア" title="X"><b>𝕏</b></a>
        <a class="diagnosis-share-service share-line" href="https://social-plugins.line.me/lineit/share?url=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="LINEでシェア" title="LINE"><b>LINE</b></a>
        <a class="diagnosis-share-service share-facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="Facebookでシェア" title="Facebook"><b>f</b></a>
        <a class="diagnosis-share-service share-threads" href="https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="Threadsでシェア" title="Threads"><b>@</b></a>
        <button class="diagnosis-share-service share-instagram diagnosis-share-instagram" type="button" aria-label="Instagramでシェア" title="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
        </button>
      </div>
      <button class="diagnosis-share-copy" type="button">シェア文とURLをコピー</button>
      <p class="diagnosis-share-feedback" role="status" aria-live="polite"></p>`;
    document.body.append(dialog);
    dialog.querySelector(".diagnosis-share-close").addEventListener("click", () => close(dialog));
    dialog.addEventListener("click", event => { if (event.target === dialog) close(dialog); });
    dialog.querySelector(".diagnosis-share-copy").addEventListener("click", async () => {
      await writeClipboard(`${text}\n${url}`);
      showFeedback(dialog, "コピーしました。");
    });
    dialog.querySelector(".diagnosis-share-instagram").addEventListener("click", async () => {
      let copied = true;
      try {
        await writeClipboard(`${text}\n${url}`);
      } catch {
        copied = false;
      }
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      showFeedback(dialog, copied ? "シェア文とURLをコピーしました。" : "Instagramを開きました。");
    });
    dialog.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setTimeout(() => close(dialog), 150)));
    dialog.showModal();
  }

  window.ResultShare = { open };
})();
