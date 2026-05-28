"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, accessCode }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "登录失败");
        return;
      }
      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{
      minHeight: "100dvh",
      display: "grid",
      placeItems: "center",
      padding: 16,
      background: "var(--bg)",
      color: "var(--text)",
    }}>
      <form onSubmit={handleSubmit} style={{
        width: "min(360px, 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 20,
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-panel)",
        boxShadow: "var(--shadow-popover)",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>Nova Agent</h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 13 }}>Sign in to your workspace</p>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          Access code
          <input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            type="password"
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>
        {error && (
          <div role="alert" style={{ color: "var(--error)", fontSize: 12 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !username.trim() || !accessCode}
          style={{
            height: 36,
            border: "none",
            borderRadius: 8,
            background: "var(--accent)",
            color: "var(--on-primary)",
            cursor: submitting ? "default" : "pointer",
            opacity: submitting || !username.trim() || !accessCode ? 0.6 : 1,
            fontWeight: 600,
          }}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const inputStyle = {
  height: 36,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
  padding: "0 10px",
  outline: "none",
  fontSize: 14,
};
