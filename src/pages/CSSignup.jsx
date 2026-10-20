import { LobbySignup } from "../components/LobbySignup.jsx";

export function CSSignup() {
  return (
    <LobbySignup
      icon="🖨️"
      title="Customer Service"
      subtitle="Quotes, invoices & client communications"
      role="cs"
      loginPath="/cs/login"
    />
  );
}
