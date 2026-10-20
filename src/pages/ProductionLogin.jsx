import { LobbyLogin } from "../components/LobbyLogin.jsx";

export function ProductionLogin() {
  return (
    <LobbyLogin
      icon="🏭"
      title="Production"
      subtitle="Press runs, schedules & job tracking"
      requiredRole="production"
      lobbyPath="/production"
      signupPath="/production/signup"
    />
  );
}
