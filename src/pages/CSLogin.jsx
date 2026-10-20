import { LobbyLogin } from "../components/LobbyLogin.jsx";

export function CSLogin() {
  return (
    <LobbyLogin
      icon="🖨️"
      title="Customer Service"
      subtitle="Quotes, invoices & client communications"
      requiredRole="cs"
      lobbyPath="/cs"
      signupPath="/cs/signup"
    />
  );
}
