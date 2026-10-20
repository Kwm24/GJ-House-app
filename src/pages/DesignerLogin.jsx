import { LobbyLogin } from "../components/LobbyLogin.jsx";

export function DesignerLogin() {
  return (
    <LobbyLogin
      icon="🎨"
      title="Design Studio"
      subtitle="Artwork, proofs & pre-press files"
      requiredRole="designer"
      lobbyPath="/designer"
      signupPath="/designer/signup"
    />
  );
}
