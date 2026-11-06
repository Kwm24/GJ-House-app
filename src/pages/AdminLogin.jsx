import { LobbyLogin } from "../components/LobbyLogin.jsx";

export function AdminLogin() {
  return (
    <LobbyLogin
      icon="🛡️"
      title="Admin"
      subtitle="Settings, users & the whole business"
      requiredRole="admin"
      lobbyPath="/admin"
    />
  );
}
