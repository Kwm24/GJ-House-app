export function LoadingScreen({ message = "Loading…" }) {
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-brand-cream/70">{message}</p>
      </div>
    </div>
  );
}
