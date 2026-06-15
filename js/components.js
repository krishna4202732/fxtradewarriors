// Reusable HTML components shared across pages. Instead of repeating identical
// markup in every page file, pages drop a <… data-component="name"> placeholder
// and this module injects the real markup at init time. This keeps shared
// blocks (footer, toast) defined in exactly one place.

// The site footer is byte-identical on every page.
export function footerMarkup() {
  return `
    <footer class="site-footer">
      <p>&copy; Krishna Upadhyay, Do not claim this as your own</p>
    </footer>
  `;
}

// The toast host is identical on every page.
export function toastMarkup() {
  return `<div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

const COMPONENT_MARKUP = {
  footer: footerMarkup,
  toast: toastMarkup,
};

// Replaces every [data-component] placeholder on the page with its shared markup.
// Call once, early in each page's init (before showToast can fire).
export function mountSharedComponents() {
  document.querySelectorAll("[data-component]").forEach((placeholder) => {
    const name = placeholder.dataset.component;
    const render = COMPONENT_MARKUP[name];

    if (render) {
      placeholder.outerHTML = render();
    }
  });
}
