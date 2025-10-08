// This module helps fix React hydration issues by suppressing warnings and handling common issues

// Utility to clean browser extension attributes that often cause hydration mismatches
export function cleanBrowserExtensionAttributes() {
  if (typeof window !== 'undefined') {
    // Clean HTML element attributes
    const html = document.documentElement;
    if (html) {
      ['data-be-installed', 'foxified'].forEach(attr => {
        if (html.hasAttribute(attr)) {
          html.removeAttribute(attr);
        }
      });
    }

    // Clean body element attributes
    const body = document.body;
    if (body) {
      ['data-liner-extension-version', 'data-new-gr-c-s-check-loaded', 'data-gr-ext-installed'].forEach(attr => {
        if (body.hasAttribute(attr)) {
          body.removeAttribute(attr);
        }
      });
    }

    // Fix extension wrapper elements 
    const extensionDivs = document.querySelectorAll('div[data-v-7d889ae9], .odm_extension, .image_downloader_wrapper');
    extensionDivs.forEach(div => {
      if (div instanceof HTMLElement) {
        div.removeAttribute('data-v-7d889ae9');
        div.classList.remove('odm_extension', 'image_downloader_wrapper');
      }
    });
  }
}

// Add to your _app or RootLayout's useEffect
export function useHydrationFix() {
  if (typeof window !== 'undefined') {
    // Apply fix once after hydration
    cleanBrowserExtensionAttributes();
    
    // Set up observer to continuously clean attributes
    const observer = new MutationObserver(() => {
      cleanBrowserExtensionAttributes();
    });
    
    // Start observing
    observer.observe(document.documentElement, {
      attributes: true, 
      childList: true, 
      subtree: true
    });
    
    // Clean up observer on component unmount
    return () => observer.disconnect();
  }
  return () => {};
}