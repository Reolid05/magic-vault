
import { useState } from "react";
import { supabase } from "./lib/supabase";
import { WandSparkles, LockKeyhole, Mail, ArrowLeft } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Tu cuenta está creada. Ya puedes entrar.");
        } else {
          setMessage("Te hemos enviado un correo para confirmar tu cuenta.");
        }
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });

        if (error) throw error;
        setMessage("Si el correo está registrado, recibirás instrucciones para cambiar tu contraseña.");
      }
    } catch (err) {
      setError(err.message || "No se ha podido completar la operación.");
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    login: "Bienvenido de nuevo",
    signup: "Crea tu cuenta",
    reset: "Recupera tu acceso"
  };

  return (
    <div className="auth-screen">
      <div className="auth-decoration">✳</div>

      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-symbol">
            <WandSparkles size={25} />
          </div>
          <div className="brand-name">MAGIC VAULT</div>
          <div className="brand-subtitle">YOUR PRIVATE WORLD OF MAGIC</div>
        </div>

        <div className="auth-divider" />

        <div className="eyebrow">ACCESO PRIVADO</div>
        <h1>{titles[mode]}</h1>
        <p className="auth-description">
          Tu conocimiento mágico, organizado en un único lugar.
        </p>

        <form onSubmit={handleSubmit}>
          <label>Correo electrónico</label>
          <div className="auth-input">
            <Mail size={17} />
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== "reset" && (
            <>
              <label>Contraseña</label>
              <div className="auth-input">
                <LockKeyhole size={17} />
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <button className="gold-button auth-submit" disabled={loading}>
            {loading
              ? "Un momento..."
              : mode === "login"
                ? "Iniciar sesión"
                : mode === "signup"
                  ? "Crear cuenta"
                  : "Enviar instrucciones"}
          </button>
        </form>

        {mode === "login" && (
          <>
            <button className="auth-link" onClick={() => setMode("reset")}>
              ¿Has olvidado tu contraseña?
            </button>
            <div className="auth-bottom">
              ¿Todavía no tienes cuenta?
              <button onClick={() => setMode("signup")}>Crear cuenta</button>
            </div>
          </>
        )}

        {mode === "signup" && (
          <div className="auth-bottom">
            ¿Ya tienes cuenta?
            <button onClick={() => setMode("login")}>Iniciar sesión</button>
          </div>
        )}

        {mode === "reset" && (
          <button className="auth-link back-link" onClick={() => setMode("login")}>
            <ArrowLeft size={14} /> Volver al inicio de sesión
          </button>
        )}

        <div className="auth-privacy">
          <LockKeyhole size={12} />
          TU BIBLIOTECA ES PRIVADA
        </div>
      </div>
    </div>
  );
}
