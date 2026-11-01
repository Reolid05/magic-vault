
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Auth from "./Auth.jsx";
import { supabase } from "./lib/supabase";
import "./style.css";

function MagicVault() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-brand">
          <div className="brand-symbol">✳</div>
          <div className="brand-name">MAGIC VAULT</div>
          <div className="brand-subtitle">PREPARANDO TU BIBLIOTECA</div>
        </div>
      </div>
    );
  }

  return session ? <App /> : <Auth />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MagicVault />
  </React.StrictMode>
);
