import { LobbySignup } from "../components/LobbySignup.jsx";

export function DesignerSignup() {
  return (
    <LobbySignup
      icon="🎨"
      title="Design Studio"
      subtitle="Artwork, proofs & pre-press files"
      role="designer"
      loginPath="/designer/login"
    />
  );
}
