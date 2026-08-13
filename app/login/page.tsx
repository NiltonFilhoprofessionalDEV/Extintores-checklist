"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import { getHomePathForRole } from "@/lib/auth/roles";
import { waitForAuthReady } from "@/lib/auth/session-client";
import BrandLogo from "@/src/components/BrandLogo";

type LoginErrorKind = "auth" | "connection" | "inactive" | "generic";

type LoginError = {
  kind: LoginErrorKind;
  message: string;
};

const AUTH_ERROR_MESSAGE =
  "E-mail ou senha incorretos. Verifique os dados e tente novamente.";

const CONNECTION_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

function isConnectionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("timeout") ||
    normalized.includes("conexão") ||
    normalized.includes("conexao")
  );
}

function resolveAuthError(errorMessage?: string | null): LoginError {
  if (!errorMessage) {
    return { kind: "auth", message: AUTH_ERROR_MESSAGE };
  }

  if (isConnectionError(errorMessage)) {
    return { kind: "connection", message: CONNECTION_ERROR_MESSAGE };
  }

  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password") ||
    normalized.includes("credenciais") ||
    normalized.includes("senha incorreta") ||
    normalized.includes("e-mail ou senha")
  ) {
    return { kind: "auth", message: AUTH_ERROR_MESSAGE };
  }

  return { kind: "auth", message: AUTH_ERROR_MESSAGE };
}

function resolveCaughtError(error: unknown): LoginError {
  if (error instanceof Error) {
    if (isConnectionError(error.message)) {
      return { kind: "connection", message: CONNECTION_ERROR_MESSAGE };
    }
    return { kind: "generic", message: error.message };
  }

  return { kind: "generic", message: "Não foi possível concluir o login." };
}

function FormAlert({ error }: { error: LoginError }) {
  const alertClass =
    error.kind === "connection" ? "form-alert form-alert--warning" : "form-alert form-alert--danger";

  return (
    <div role="alert" className={alertClass}>
      <svg
        className="form-alert__icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {error.kind === "connection" ? (
          <>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </>
        )}
      </svg>
      <span>{error.message}</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<LoginError | null>(null);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        await waitForAuthReady();
        const session = await getCurrentSession();
        if (!session) return;

        const profile = await getProfileBySession(session);
        if (profile?.active && mounted) {
          router.replace(getHomePathForRole(profile.role));
        }
      } catch {
        // Mantém na tela de login se não conseguir validar perfil
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseClient();
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !data.session) {
        setError(resolveAuthError(signInError?.message));
        setLoading(false);
        return;
      }

      const profile = await getProfileBySession(data.session);
      if (!profile?.active) {
        await supabase.auth.signOut();
        setError({
          kind: "inactive",
          message: "Usuário desativado. Contate o administrador.",
        });
        setLoading(false);
        return;
      }

      router.replace(getHomePathForRole(profile.role));
    } catch (err) {
      setError(resolveCaughtError(err));
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="login-screen">
        <div className="login-screen__body">
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--fc-text-secondary)]">
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--fc-primary)] border-t-transparent"
              aria-hidden
            />
            Verificando sessão…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-screen">
      <div className="login-screen__body">
        <div className="login-screen__card reveal-up">
          <header>
            <div className="login-screen__brand">
              <BrandLogo height={52} priority />
            </div>
            <p className="page-eyebrow login-screen__eyebrow">ACESSO SEGURO</p>
            <h1 className="login-screen__title font-display">Bem-vindo de volta</h1>
            <p className="login-screen__subtitle">
              Entre com suas credenciais para acessar o FireCheck.
            </p>
          </header>

          <form className="login-screen__form" onSubmit={handleLogin} noValidate>
            <div className="login-screen__field">
              <label htmlFor="email" className="login-screen__label">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                placeholder="nome@empresa.com"
                className="field-control field-control--touch"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="login-screen__field">
              <label htmlFor="password" className="login-screen__label">Senha</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  enterKeyHint="go"
                  placeholder="Digite sua senha"
                  className="field-control field-control--touch !pr-12"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  className="login-screen__password-toggle"
                  disabled={loading}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {showPassword ? (
                      <>
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4M9.9 5.1A11 11 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.4M6.6 6.6A13 13 0 0 0 2 12c1 2.5 5 7 10 7a11 11 0 0 0 4.4-.9" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4">
                <FormAlert error={error} />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary login-screen__submit pressable w-full"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                    aria-hidden
                  />
                  Entrando...
                </span>
              ) : (
                "Entrar no FireCheck"
              )}
            </button>
          </form>
        </div>
      </div>

      <footer className="login-screen__footer">FireCheck • v1.0.0</footer>
    </main>
  );
}
