(function () {
  "use strict";

  const config = window.MINQ_ADSENSE_CONFIG || {};
  const clientPattern = /^ca-pub-\d{16}$/;
  const slotPattern = /^\d{5,20}$/;
  let scriptPromise = null;

  function loadAdSenseScript() {
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-minq-adsense="true"]');
      if (existing) {
        if (window.adsbygoogle) resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.minqAdsense = "true";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.client)}`;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });

    return scriptPromise;
  }

  async function mountAdSenseAds(root = document) {
    if (!clientPattern.test(String(config.client || ""))) return;

    const loadPromise = loadAdSenseScript();

    const placements = [...root.querySelectorAll("[data-ad-placement]")].filter(
      placement => placement.dataset.adMounted !== "true"
    );
    const ready = placements.filter(placement => {
      const slot = config.slots?.[placement.dataset.adPlacement];
      return slotPattern.test(String(slot || ""));
    });
    if (!ready.length) {
      loadPromise.catch(error => console.warn("AdSense could not be loaded.", error));
      return;
    }

    ready.forEach(placement => {
      const slot = config.slots[placement.dataset.adPlacement];
      const label = document.createElement("span");
      label.className = "ad-label";
      label.textContent = "広告";

      const ad = document.createElement("ins");
      ad.className = "adsbygoogle";
      ad.style.display = "block";
      ad.dataset.adClient = config.client;
      ad.dataset.adSlot = slot;
      ad.dataset.adFormat = "auto";
      ad.dataset.fullWidthResponsive = "true";
      if (config.testMode) ad.dataset.adtest = "on";

      placement.dataset.adMounted = "true";
      placement.classList.add("is-enabled");
      placement.replaceChildren(label, ad);
    });

    try {
      await loadPromise;
      ready.forEach(() => {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      });
    } catch (error) {
      console.warn("AdSense could not be loaded.", error);
    }
  }

  window.mountAdSenseAds = mountAdSenseAds;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountAdSenseAds(), { once: true });
  } else {
    mountAdSenseAds();
  }
})();
