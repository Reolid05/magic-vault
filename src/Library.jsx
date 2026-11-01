
import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Upload,
  FileText,
  Trash2,
  Search,
  LoaderCircle,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  ExternalLink,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCw
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const BUCKET = "magic-vault-books";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BATCH_SIZE = 10;
const ANALYSIS_BATCH_LIMIT = 10;

const STATUS_LABELS = {
  uploaded: "PDF guardado",
  extracting: "Leyendo páginas",
  ready: "Texto extraído",
  needs_ocr: "Algunas páginas necesitan OCR",
  error: "Error de lectura"
};

const CATEGORY_LABELS = {
  juego: "Juego",
  tecnica: "Técnica",
  concepto: "Concepto",
  teoria: "Teoría",
  principio: "Principio"
};

export default function Library() {
  const [books, setBooks] = useState([]);
  const [insights, setInsights] = useState([]);
  const [analysisStates, setAnalysisStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzingBookId, setAnalyzingBookId] = useState(null);
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedInsights, setExpandedInsights] = useState({});
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const fileInput = useRef(null);

  async function loadBooks() {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError("No se han podido cargar los libros: " + error.message);
    } else {
      setBooks(data || []);
    }
  }

  async function loadInsights() {
    const { data, error } = await supabase
      .from("book_insights")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setInsights(data || []);
  }

  async function loadAnalysisStates() {
    const { data, error } = await supabase
      .from("book_analysis_state")
      .select("*");

    if (!error) {
      const mapped = {};
      (data || []).forEach((item) => {
        mapped[item.book_id] = item;
      });
      setAnalysisStates(mapped);
    }
  }

  async function refreshLibrary() {
    await Promise.all([
      loadBooks(),
      loadInsights(),
      loadAnalysisStates()
    ]);
  }

  useEffect(() => {
    async function initialise() {
      setLoading(true);
      await refreshLibrary();
      setLoading(false);
    }

    initialise();
  }, []);

  async function extractPdfPages(file, bookId, userId) {
    const bytes = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: bytes
    }).promise;

    const totalPages = pdf.numPages;
    let batch = [];
    let pagesWithText = 0;
    let pagesWithoutText = 0;

    await supabase
      .from("books")
      .update({
        page_count: totalPages,
        processing_status: "extracting",
        processing_error: null
      })
      .eq("id", bookId);

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      setProgress(`Leyendo página ${pageNumber} de ${totalPages}...`);

      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => {
          if ("str" in item) {
            return item.str + (item.hasEOL ? "\n" : " ");
          }
          return "";
        })
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (pageText.length > 0) {
        pagesWithText++;
      } else {
        pagesWithoutText++;
      }

      batch.push({
        user_id: userId,
        book_id: bookId,
        page_number: pageNumber,
        content: pageText
      });

      if (batch.length >= BATCH_SIZE || pageNumber === totalPages) {
        const { error: insertError } = await supabase
          .from("book_pages")
          .insert(batch);

        if (insertError) throw insertError;
        batch = [];
      }

      page.cleanup();
    }

    await pdf.destroy();

    const status = pagesWithText === 0 || pagesWithoutText > 0
      ? "needs_ocr"
      : "ready";

    const { error: updateError } = await supabase
      .from("books")
      .update({
        page_count: totalPages,
        processing_status: status,
        processing_error: null
      })
      .eq("id", bookId);

    if (updateError) throw updateError;

    return {
      totalPages,
      pagesWithText,
      pagesWithoutText,
      status
    };
  }

  async function uploadBook(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setError("");
    setMessage("");

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Selecciona un archivo PDF.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("El archivo supera el límite de 50 MB.");
      return;
    }

    setUploading(true);
    setProgress("Preparando el libro...");

    let uploadedPath = null;
    let bookCreated = false;
    let bookId = null;

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");
      }

      const user = userData.user;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const title = file.name.replace(/\.pdf$/i, "");

      bookId = crypto.randomUUID();
      uploadedPath = `${user.id}/${bookId}/${safeName}`;

      setProgress("Guardando el PDF original...");

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(uploadedPath, file, {
          contentType: "application/pdf",
          upsert: false
        });

      if (storageError) throw storageError;

      const { error: databaseError } = await supabase
        .from("books")
        .insert({
          id: bookId,
          user_id: user.id,
          title,
          file_name: file.name,
          file_path: uploadedPath,
          file_type: "application/pdf",
          file_size: file.size,
          processing_status: "uploaded"
        });

      if (databaseError) throw databaseError;
      bookCreated = true;

      setProgress("Extrayendo el texto de cada página...");

      const result = await extractPdfPages(file, bookId, user.id);

      if (result.status === "ready") {
        setMessage(
          `Libro añadido. Se han leído ${result.totalPages} páginas correctamente.`
        );
      } else {
        setMessage(
          `PDF guardado. ${result.pagesWithText} páginas tienen texto y ${result.pagesWithoutText} necesitan OCR.`
        );
      }

      await refreshLibrary();
    } catch (err) {
      if (bookCreated && bookId) {
        await supabase
          .from("books")
          .update({
            processing_status: "error",
            processing_error: err.message || "Error desconocido"
          })
          .eq("id", bookId);
      } else if (uploadedPath) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);
      }

      setError(err.message || "No se ha podido procesar el libro.");
      await refreshLibrary();
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  async function analyzeBook(book) {
    if (analyzingBookId) return;

    setError("");
    setMessage("");
    setAnalyzingBookId(book.id);

    let completed = false;
    let totalFound = 0;
    let lastPage = analysisStates[book.id]?.last_page || 0;

    try {
      for (let batch = 0; batch < ANALYSIS_BATCH_LIMIT; batch++) {
        setProgress(
          `La IA está analizando ${book.title}. Última página procesada: ${lastPage}.`
        );

        const { data, error: functionError } =
          await supabase.functions.invoke("analyze-book", {
            body: { book_id: book.id }
          });

        if (functionError) {
          let detail = functionError.message;

          try {
            const response = functionError.context;
            if (response && typeof response.json === "function") {
              const body = await response.json();
              detail = body.error || detail;
            }
          } catch {
            // Se conserva el mensaje original.
          }

          throw new Error(detail || "No se pudo ejecutar el análisis.");
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        lastPage = data?.last_page ?? lastPage;
        totalFound += data?.found || 0;

        await loadInsights();
        await loadAnalysisStates();

        if (data?.completed) {
          completed = true;
          break;
        }

        if (!data?.pages_processed && data?.found === 0) {
          // La función puede haber avanzado un bloque vacío.
          // La siguiente llamada continuará desde la página guardada.
        }
      }

      if (completed) {
        setMessage(
          `Análisis terminado. La IA ha encontrado ${totalFound} fichas nuevas en este proceso.`
        );
      } else {
        setMessage(
          `Se ha avanzado hasta la página ${lastPage}. Pulsa «Continuar análisis» para seguir con el resto del libro. Se han encontrado ${totalFound} fichas nuevas en este proceso.`
        );
      }

      await refreshLibrary();
    } catch (err) {
      setError(
        err.message ||
        "Ha ocurrido un error durante el análisis del libro."
      );
      await refreshLibrary();
    } finally {
      setAnalyzingBookId(null);
      setProgress("");
    }
  }

  async function deleteBook(book) {
    const confirmed = window.confirm(
      `¿Quieres eliminar "${book.title}" y todo su contenido extraído?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([book.file_path]);

    if (storageError) {
      setError("No se ha podido eliminar el archivo: " + storageError.message);
      return;
    }

    const { error: databaseError } = await supabase
      .from("books")
      .delete()
      .eq("id", book.id);

    if (databaseError) {
      setError("No se ha podido eliminar el registro: " + databaseError.message);
      return;
    }

    setMessage("Libro y contenido asociado eliminados.");
    await refreshLibrary();
  }

  async function openOriginal(book) {
    setError("");

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(book.file_path, 60);

    if (error) {
      setError("No se ha podido abrir el PDF: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function toggleBook(bookId) {
    setExpandedBooks((current) => ({
      ...current,
      [bookId]: !current[bookId]
    }));
  }

  function toggleInsight(insightId) {
    setExpandedInsights((current) => ({
      ...current,
      [insightId]: !current[insightId]
    }));
  }

  const visibleBooks = books.filter((book) =>
    (book.title || "").toLowerCase().includes(search.toLowerCase())
  );

  function getBookInsights(bookId) {
    return insights.filter((item) => item.book_id === bookId);
  }

  return (
    <section className="library-page">
      <div className="library-heading">
        <div>
          <div className="eyebrow">TU COLECCIÓN PERSONAL</div>
          <h2>Mi biblioteca</h2>
          <p>
            Tus libros, sus páginas y el conocimiento que la IA extrae de ellos.
          </p>
        </div>

        <button
          className="gold-button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading || !!analyzingBookId}
        >
          {uploading
            ? <LoaderCircle className="spin" size={17} />
            : <Upload size={17} />}
          {uploading ? "Procesando..." : "Importar PDF"}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          onChange={uploadBook}
          hidden
        />
      </div>

      {(uploading || analyzingBookId) && (
        <div className="processing-banner">
          <LoaderCircle className="spin" size={17} />
          <span>{progress}</span>
        </div>
      )}

      <div className="library-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar un libro por su título..."
          />
        </div>
        <span className="book-count">{books.length} libros</span>
      </div>

      {message && (
        <div className="library-message">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      {error && (
        <div className="library-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="library-empty">
          <LoaderCircle className="spin" />
          Cargando biblioteca...
        </div>
      ) : visibleBooks.length === 0 ? (
        <div className="library-empty">
          <div className="empty-icon">
            <BookOpen size={26} />
          </div>
          <h3>
            {search ? "No se han encontrado libros" : "Tu biblioteca está vacía"}
          </h3>
          <p>
            {search
              ? "Prueba con otro título."
              : "Importa tu primer PDF para comenzar a construir tu biblioteca mágica."}
          </p>
          {!search && (
            <button
              className="gold-button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              <Upload size={16} /> Importar primer libro
            </button>
          )}
        </div>
      ) : (
        <div className="book-grid">
          {visibleBooks.map((book) => {
            const bookInsights = getBookInsights(book.id);
            const state = analysisStates[book.id];
            const isExpanded = !!expandedBooks[book.id];
            const isAnalyzing = analyzingBookId === book.id;
            const hasPages = (book.page_count || 0) > 0;
            const analysisFinished = state?.status === "completed";

            return (
              <article className="book-card book-card-expanded" key={book.id}>
                <div className="book-cover">
                  <FileText size={30} />
                </div>

                <div className="book-info">
                  <h3>{book.title}</h3>
                  <p>{book.file_name || "Documento PDF"}</p>

                  <span>
                    {book.page_count
                      ? `${book.page_count} páginas`
                      : book.file_size
                        ? `${(book.file_size / 1024 / 1024).toFixed(1)} MB`
                        : "PDF"}
                  </span>

                  <div className={`book-status status-${book.processing_status || "uploaded"}`}>
                    {book.processing_status === "ready" && <CheckCircle2 size={12} />}
                    {book.processing_status === "needs_ocr" && <FileSearch size={12} />}
                    {book.processing_status === "error" && <AlertCircle size={12} />}
                    {book.processing_status === "extracting" && <LoaderCircle size={12} />}
                    {STATUS_LABELS[book.processing_status] || "Pendiente de lectura"}
                  </div>

                  <div className="book-ai-summary">
                    <Sparkles size={13} />
                    {bookInsights.length} fichas encontradas
                  </div>
                </div>

                <div className="book-actions">
                  <button
                    className="delete-book"
                    title="Abrir PDF original"
                    onClick={() => openOriginal(book)}
                  >
                    <ExternalLink size={16} />
                  </button>

                  <button
                    className="delete-book"
                    title="Eliminar libro"
                    onClick={() => deleteBook(book)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="book-analysis-controls">
                  <button
                    className="outline-button analysis-button"
                    onClick={() => analyzeBook(book)}
                    disabled={!hasPages || !!analyzingBookId || analysisFinished}
                    title={
                      !hasPages
                        ? "Este libro todavía no tiene páginas extraídas"
                        : analysisFinished
                          ? "El análisis ha terminado"
                          : "Analizar o continuar el análisis"
                    }
                  >
                    {isAnalyzing
                      ? <LoaderCircle className="spin" size={15} />
                      : analysisFinished
                        ? <CheckCircle2 size={15} />
                        : <Brain size={15} />}
                    {isAnalyzing
                      ? "Analizando..."
                      : analysisFinished
                        ? "Análisis completado"
                        : state?.last_page
                          ? "Continuar análisis"
                          : "Analizar libro"}
                  </button>

                  {state?.last_page > 0 && (
                    <span className="analysis-progress">
                      Última página analizada: {state.last_page}
                      {book.page_count ? ` / ${book.page_count}` : ""}
                    </span>
                  )}
                </div>

                {bookInsights.length > 0 && (
                  <div className="book-insights-section">
                    <button
                      className="insights-toggle"
                      onClick={() => toggleBook(book.id)}
                    >
                      <span>
                        <Sparkles size={15} />
                        Conocimiento detectado ({bookInsights.length})
                      </span>
                      {isExpanded
                        ? <ChevronUp size={17} />
                        : <ChevronDown size={17} />}
                    </button>

                    {isExpanded && (
                      <div className="insights-list">
                        {bookInsights.map((insight) => {
                          const expanded = !!expandedInsights[insight.id];

                          return (
                            <div className="insight-card" key={insight.id}>
                              <div className="insight-topline">
                                <span className="insight-category">
                                  {CATEGORY_LABELS[insight.category] || insight.category}
                                </span>
                                <span className="insight-pages">
                                  {insight.page_start === insight.page_end
                                    ? `Pág. ${insight.page_start}`
                                    : `Págs. ${insight.page_start}–${insight.page_end}`}
                                </span>
                              </div>

                              <h4>{insight.title}</h4>
                              <p>{insight.summary}</p>

                              <button
                                className="source-toggle"
                                onClick={() => toggleInsight(insight.id)}
                              >
                                {expanded ? "Ocultar fuente" : "Ver fragmento original"}
                              </button>

                              {expanded && (
                                <blockquote className="insight-excerpt">
                                  “{insight.source_excerpt}”
                                  <span>
                                    Fuente: {book.title}, página {insight.page_start}
                                  </span>
                                </blockquote>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
