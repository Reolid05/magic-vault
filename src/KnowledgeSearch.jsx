
import { useState } from "react";
import { supabase } from "./lib/supabase";
import {
  Search,
  LoaderCircle,
  BookOpen,
  Sparkles,
  FileText,
  AlertCircle,
  X
} from "lucide-react";

function makeSnippet(content, term) {
  const text = content || "";
  const index = text.toLowerCase().indexOf(term.toLowerCase());

  if (index === -1) {
    return text.slice(0, 260) + (text.length > 260 ? "…" : "");
  }

  const start = Math.max(0, index - 110);
  const end = Math.min(text.length, index + term.length + 150);

  return (
    (start > 0 ? "… " : "") +
    text.slice(start, end).trim() +
    (end < text.length ? " …" : "")
  );
}

export default function KnowledgeSearch() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("todo");

  async function searchKnowledge(event) {
    event?.preventDefault();

    const query = term.trim();

    if (query.length < 2) {
      setError("Escribe al menos dos caracteres para buscar.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);
    setResults([]);

    try {
      const pattern = `%${query}%`;

      const [
        pagesResponse,
        titlesResponse,
        summariesResponse,
        excerptsResponse
      ] = await Promise.all([
        supabase
          .from("book_pages")
          .select("id, book_id, page_number, content")
          .ilike("content", pattern)
          .order("page_number", { ascending: true })
          .limit(40),

        supabase
          .from("book_insights")
          .select("*")
          .ilike("title", pattern)
          .limit(30),

        supabase
          .from("book_insights")
          .select("*")
          .ilike("summary", pattern)
          .limit(30),

        supabase
          .from("book_insights")
          .select("*")
          .ilike("source_excerpt", pattern)
          .limit(30)
      ]);

      const firstError =
        pagesResponse.error ||
        titlesResponse.error ||
        summariesResponse.error ||
        excerptsResponse.error;

      if (firstError) throw firstError;

      const pageResults = (pagesResponse.data || []).map((page) => ({
        id: `page-${page.id}`,
        type: "pagina",
        book_id: page.book_id,
        page_number: page.page_number,
        title: `Página ${page.page_number}`,
        summary: makeSnippet(page.content, query),
        category: "Texto del libro"
      }));

      const insightMap = new Map();

      [
        ...(titlesResponse.data || []),
        ...(summariesResponse.data || []),
        ...(excerptsResponse.data || [])
      ].forEach((item) => {
        insightMap.set(item.id, item);
      });

      const insightResults = Array.from(insightMap.values()).map((item) => ({
        id: `insight-${item.id}`,
        type: "ficha",
        book_id: item.book_id,
        page_number: item.page_start,
        title: item.title,
        summary: item.summary,
        excerpt: item.source_excerpt,
        category: item.category
      }));

      const combined = [...insightResults, ...pageResults];

      const bookIds = [...new Set(combined.map((item) => item.book_id))];

      let bookNames = {};

      if (bookIds.length > 0) {
        const { data: bookData, error: bookError } = await supabase
          .from("books")
          .select("id, title")
          .in("id", bookIds);

        if (bookError) throw bookError;

        bookNames = Object.fromEntries(
          (bookData || []).map((book) => [book.id, book.title])
        );
      }

      const finalResults = combined.map((item) => ({
        ...item,
        book_title: bookNames[item.book_id] || "Libro de tu biblioteca"
      }));

      setResults(finalResults);
    } catch (err) {
      setError(err.message || "No se ha podido realizar la búsqueda.");
    } finally {
      setLoading(false);
    }
  }

  const filteredResults = results.filter((item) => {
    if (filter === "todo") return true;
    if (filter === "fichas") return item.type === "ficha";
    if (filter === "paginas") return item.type === "pagina";
    return item.category === filter;
  });

  return (
    <section className="knowledge-search-page">
      <div className="eyebrow">EXPLORADOR DE CONOCIMIENTO</div>
      <h1>Buscar en tu biblioteca</h1>
      <p className="search-intro">
        Encuentra juegos, técnicas, principios y fragmentos en todos tus libros.
      </p>

      <form className="knowledge-search-form" onSubmit={searchKnowledge}>
        <Search size={20} />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Ej. carta elegida, falsa mezcla, predicción..."
          aria-label="Buscar en la biblioteca"
        />
        {term && (
          <button
            type="button"
            className="clear-search"
            onClick={() => {
              setTerm("");
              setResults([]);
              setSearched(false);
              setError("");
            }}
            aria-label="Limpiar búsqueda"
          >
            <X size={17} />
          </button>
        )}
        <button className="gold-button" type="submit" disabled={loading}>
          {loading
            ? <LoaderCircle className="spin" size={16} />
            : <Search size={16} />}
          Buscar
        </button>
      </form>

      <div className="search-hint">
        <Sparkles size={14} />
        La búsqueda actual encuentra coincidencias de texto en tus páginas y fichas.
      </div>

      {error && (
        <div className="library-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && (
        <div className="search-loading">
          <LoaderCircle className="spin" size={22} />
          Buscando en tu biblioteca...
        </div>
      )}

      {!loading && searched && results.length > 0 && (
        <>
          <div className="search-results-header">
            <div>
              <span className="eyebrow">RESULTADOS</span>
              <h2>{results.length} coincidencias encontradas</h2>
            </div>
            <select
              className="search-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="todo">Todo el contenido</option>
              <option value="fichas">Fichas de IA</option>
              <option value="paginas">Páginas originales</option>
              <option value="juego">Juegos</option>
              <option value="tecnica">Técnicas</option>
              <option value="concepto">Conceptos</option>
              <option value="teoria">Teoría</option>
              <option value="principio">Principios</option>
            </select>
          </div>

          <div className="knowledge-results">
            {filteredResults.map((item) => (
              <article className="knowledge-result" key={item.id}>
                <div className="knowledge-result-icon">
                  {item.type === "ficha"
                    ? <Sparkles size={19} />
                    : <FileText size={19} />}
                </div>

                <div className="knowledge-result-content">
                  <div className="knowledge-result-meta">
                    <span>{item.category}</span>
                    <span>{item.book_title}</span>
                    <span>Pág. {item.page_number || "Pendiente"}</span>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>

                  {item.excerpt && (
                    <blockquote className="search-excerpt">
                      “{item.excerpt}”
                    </blockquote>
                  )}
                </div>
              </article>
            ))}
          </div>

          {filteredResults.length === 0 && (
            <div className="library-empty">
              <Search size={25} />
              <h3>No hay resultados en este filtro</h3>
              <p>Prueba otra categoría o vuelve a mostrar todo el contenido.</p>
            </div>
          )}
        </>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div className="library-empty">
          <BookOpen size={26} />
          <h3>No hemos encontrado coincidencias</h3>
          <p>
            Prueba con otras palabras. También puedes buscar una técnica,
            un concepto o una frase que recuerdes del libro.
          </p>
        </div>
      )}

      {!searched && (
        <div className="search-welcome">
          <div className="empty-icon">
            <Search size={25} />
          </div>
          <h3>Todo tu conocimiento, en un solo lugar</h3>
          <p>
            Escribe una palabra o expresión para localizarla en las páginas
            y fichas de tus libros.
          </p>
        </div>
      )}
    </section>
  );
}
