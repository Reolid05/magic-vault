
import { useState } from "react";
import {
  WandSparkles,
  Library,
  Layers,
  Lightbulb,
  Search,
  BookOpen,
  Plus,
  ChevronRight,
  Sparkles,
  Settings,
  Bookmark,
  Menu,
  X
} from "lucide-react";

const navigation = [
  { id: "inicio", label: "Inicio", icon: Layers },
  { id: "biblioteca", label: "Mi biblioteca", icon: Library },
  { id: "repertorio", label: "Mi repertorio", icon: WandSparkles },
  { id: "tecnicas", label: "Técnicas", icon: Lightbulb },
  { id: "conceptos", label: "Conceptos", icon: BookOpen },
  { id: "favoritos", label: "Favoritos", icon: Bookmark }
];

function App() {
  const [active, setActive] = useState("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const current = navigation.find((item) => item.id === active);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-symbol"><WandSparkles size={23} /></div>
          <div>
            <div className="brand-name">MAGIC VAULT</div>
            <div className="brand-subtitle">THE MAGIC LIBRARY</div>
          </div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)}>
            <X size={19} />
          </button>
        </div>

        <div className="side-label">ESPACIO PERSONAL</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${active === item.id ? "active" : ""}`}
                onClick={() => {
                  setActive(item.id);
                  setMenuOpen(false);
                }}
              >
                <Icon size={18} strokeWidth={1.7} />
                <span>{item.label}</span>
                {active === item.id && <span className="active-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="vault-card">
            <Sparkles size={19} />
            <div>
              <strong>Tu conocimiento</strong>
              <p>Un universo de posibilidades.</p>
            </div>
          </div>
          <button className="nav-item settings-item">
            <Settings size={18} />
            <span>Configuración</span>
          </button>
          <div className="user-profile">
            <div className="avatar">M</div>
            <div>
              <strong>Mi cuenta</strong>
              <span>MAGIC VAULT</span>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)}>
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>MAGIC VAULT</span>
            <ChevronRight size={14} />
            <strong>{current?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <span className="status-dot" /> BIBLIOTECA PRIVADA
            </span>
            <div className="top-avatar">M</div>
          </div>
        </header>

        <div className="content">
          {active === "inicio" && (
            <>
              <section className="welcome-section">
                <div className="eyebrow"><Sparkles size={14} /> TU UNIVERSO MÁGICO</div>
                <h1>El conocimiento<br /><span>es tu mayor secreto.</span></h1>
                <p className="welcome-description">
                  Tu espacio privado para descubrir, organizar y dominar
                  los secretos de la magia.
                </p>
                <div className="welcome-actions">
                  <button className="gold-button" onClick={() => setActive("biblioteca")}>
                    <Plus size={17} /> Añadir un libro
                  </button>
                  <button className="outline-button" onClick={() => setActive("repertorio")}>
                    Explorar repertorio <ChevronRight size={16} />
                  </button>
                </div>
              </section>

              <section className="stats-grid">
                <Stat icon={Library} label="LIBROS" value="0" detail="Tu biblioteca" />
                <Stat icon={WandSparkles} label="JUEGOS" value="0" detail="Tu repertorio" />
                <Stat icon={Lightbulb} label="TÉCNICAS" value="0" detail="Métodos y recursos" />
                <Stat icon={BookOpen} label="CONCEPTOS" value="0" detail="Ideas y principios" />
              </section>

              <section className="dashboard-grid">
                <div className="panel recent-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">TU COLECCIÓN</span>
                      <h2>Biblioteca reciente</h2>
                    </div>
                    <button className="text-button" onClick={() => setActive("biblioteca")}>
                      Ver biblioteca <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="empty-state">
                    <div className="empty-icon"><Library size={25} /></div>
                    <h3>Tu biblioteca comienza aquí</h3>
                    <p>Añade tus libros de magia y empieza a construir tu archivo personal de conocimiento.</p>
                    <button className="outline-button" onClick={() => setActive("biblioteca")}>
                      <Plus size={16} /> Añadir primer libro
                    </button>
                  </div>
                </div>

                <div className="panel assistant-panel">
                  <div className="assistant-icon"><Sparkles size={22} /></div>
                  <span className="eyebrow">INTELIGENCIA MÁGICA</span>
                  <h2>Tu asistente de magia</h2>
                  <p>Un asistente que podrá consultar tus libros, encontrar técnicas y relacionar ideas de tu biblioteca.</p>
                  <div className="assistant-status">
                    <span className="status-dot muted" /> Próximamente disponible
                  </div>
                </div>
              </section>
            </>
          )}

          {active !== "inicio" && (
            <section className="section-page">
              <div className="eyebrow">MAGIC VAULT / TU ESPACIO</div>
              <h1>{current?.label}</h1>
              <p className="section-description">
                Aquí organizarás y consultarás todo tu conocimiento mágico.
              </p>

              <div className="search-box">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Buscar en ${current?.label.toLowerCase()}...`}
                />
              </div>

              {active === "biblioteca" ? (
                <div className="empty-state section-empty">
                  <div className="empty-icon"><Library size={25} /></div>
                  <h3>Aún no tienes libros</h3>
                  <p>En esta sección podrás importar PDF, documentos y fotografías de tus libros.</p>
                  <button className="gold-button" disabled>
                    <Plus size={17} /> Importación próximamente
                  </button>
                </div>
              ) : (
                <div className="empty-state section-empty">
                  <div className="empty-icon"><WandSparkles size={25} /></div>
                  <h3>Tu colección está esperando</h3>
                  <p>Cuando incorpores tus libros, podrás guardar y organizar aquí la información extraída.</p>
                </div>
              )}
            </section>
          )}
          <footer className="footer">
            <span>MAGIC VAULT</span>
            <span>YOUR PRIVATE WORLD OF MAGIC</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

export default App;
