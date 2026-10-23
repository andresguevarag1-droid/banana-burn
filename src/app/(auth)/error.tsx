"use client";
import { ErrorState } from "@/components/error-state";

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} reset={reset} homeHref="/" homeLabel="Ir al inicio" full area="auth" />;
}
