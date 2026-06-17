// =============================================================================
// Reusable secondary-tab controller (vanilla, no dependencies).
// =============================================================================
//
// Markup contract (purely presentational — no business logic):
//   <div class="tab-bar" data-tabs="<group>">
//     <button data-tab="<group>" data-tab-target="<panelId>">Label</button> ...
//   </div>
//   <div data-tab-panel="<group>" id="<panelId>"> ... </div> ...
//
// Activating a tab toggles `is-active` on the buttons and shows exactly one
// panel (the rest get `is-hidden`). It never touches the panel's inner markup,
// so every existing element ID and its JS wiring keep working unchanged.
// =============================================================================

export function setupTabs(group, { defaultTarget } = {}) {
  const buttons = Array.from(document.querySelectorAll(`[data-tab="${group}"]`));
  const panels = Array.from(document.querySelectorAll(`[data-tab-panel="${group}"]`));

  if (buttons.length === 0 || panels.length === 0) {
    return;
  }

  function activate(targetId) {
    buttons.forEach((button) => {
      const isActive = button.dataset.tabTarget === targetId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      panel.classList.toggle("is-hidden", panel.id !== targetId);
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button.dataset.tabTarget));
  });

  const initial = defaultTarget || buttons[0].dataset.tabTarget;
  activate(initial);
}
