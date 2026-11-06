export const ROLE_ROUTES = {
  cs: "/cs",
  production: "/production",
  designer: "/designer",
  accounts: "/accounts",
  customer: "/customer",
  admin: "/admin",
};

export function getRouteForRole(role) {
  return ROLE_ROUTES[role] ?? "/login";
}

// Where each role signs in. /login is for customers only; staff use their
// lobby's own login page.
export const LOGIN_ROUTES = {
  cs: "/cs/login",
  production: "/production/login",
  designer: "/designer/login",
  accounts: "/accounts/login",
  admin: "/admin/login",
  customer: "/login",
};

export function getLoginRouteForRole(role) {
  return LOGIN_ROUTES[role] ?? "/login";
}

export const ROLE_LABELS = {
  cs: "Customer Service",
  production: "Production",
  designer: "Designer",
  accounts: "Accounts",
  admin: "Admin",
  customer: "Customer",
};
