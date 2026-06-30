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
