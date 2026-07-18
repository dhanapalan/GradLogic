/**
 * Central selector registry — prefer these constants inside Page Objects.
 * Prefer role/label/name over CSS; add data-testid here when the app gains them.
 */
export const SELECTORS = {
  auth: {
    identifier: "#identifier",
    password: "#password",
    roleTablist: '[role="tablist"][aria-label="Login role"]',
    signIn: 'button:has-text("Sign In")',
    newPassword: "#new-password",
    confirmPassword: "#confirm-password",
  },
  college: {
    search: 'input[placeholder="Search colleges..."]',
    field: (name: string) => `[name="${name}"]`,
    tempPasswordCode: "code",
    copyPassword: '[title="Copy password"]',
    view: '[aria-label="View college"]',
    edit: '[aria-label="Edit college"]',
    suspend: '[aria-label="Suspend college"]',
    activate: '[aria-label="Activate college"]',
  },
  confirm: {
    dialog: '[role="dialog"]',
    title: "#confirm-modal-title",
    message: "#confirm-modal-message",
  },
  student: {
    search: 'input[placeholder*="Search name, email, roll"]',
    onboardingField: (name: string) => `[name="${name}"]`,
  },
} as const;
