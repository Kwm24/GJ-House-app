import { LobbyLogin } from "../components/LobbyLogin.jsx";

export function AccountsLogin() {
  return (
    <LobbyLogin
      icon="📊"
      title="Accounts"
      subtitle="Invoices, payments & financial records"
      requiredRole="accounts"
      lobbyPath="/accounts"
    />
  );
}
