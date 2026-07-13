(function () {
  "use strict";

  const form = document.getElementById("contactForm");
  const submitButton = document.getElementById("contactSubmit");
  const status = document.getElementById("contactStatus");
  if (!form || !submitButton || !status) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    submitButton.disabled = true;
    submitButton.textContent = "送信中...";
    status.className = "contact-status";
    status.textContent = "";

    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const response = await fetch("/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.message || "送信に失敗しました。");

      form.reset();
      status.classList.add("is-success");
      status.textContent = data.message || "お問い合わせを送信しました。";
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = error.message || "送信に失敗しました。時間をおいてから再度お試しください。";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "送信する";
    }
  });
})();
