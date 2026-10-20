import { LobbySignup } from "../components/LobbySignup.jsx";

export function ProductionSignup() {
  return (
    <LobbySignup
      icon="🏭"
      title="Production"
      subtitle="Press runs, schedules & job tracking"
      role="production"
      loginPath="/production/login"
    />
  );
}
