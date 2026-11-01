
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";
import {
  ScanText,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Play,
  RefreshCw
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function OCR() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBook, setActiveBook] = useState(null);
  const [progress, setProgress] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadBooks() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("books")
      .select("id, title, file_path, page_count, processing_status")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setBooks(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadBooks();
  }, []);

  async function runOCR(book) {
    if (activeBook) return;

    setActiveBook(book.id);
    setProgressValue(0);
    setProgress("Preparando el reconocimiento...");
    setMessage("");
    setError("");

    let worker = null;
    let pdf = null;

    try {
      const { data: fileBlob, error: downloadError } =
        await supabase.storage
          .from("magic-vault-books")
          .download(book.file_path);

      if (downloadError) throw downloadError;

      const bytes = await fileBlob.arrayBuffer();

      pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

      const { data: existingPages, error: pagesError } = await supabase
        .from("book_pages")
        .select("page_number, content")
        .eq("book_id", book.id)
        .order("page_number", { ascending: true });

      if (pagesError) throw pagesError;

      const existingMap = new Map(
        (existingPages || []).map((page) => [
          page.page_number,
          page.content || ""
        ])
      );

      const pagesToRead = [];

      for (let number = 1; number <= pdf.numPages; number++) {
        const currentText = existingMap.get(number);

        if (!currentText || currentText.trim().length === 0) {
          pagesToRead.push(number);
        }
      }

      if (pagesToRead.length === 0) {
        setMessage("Este libro ya tiene texto en todas sus páginas.");
        return;
      }

      setProgress("Cargando el motor de reconocimiento en español e inglés...");

      worker = await createWorker("spa+eng");

      let processed = 0;
      let recognized = 0;

      for (const pageNumber of pagesToRead) {
        setProgress(
          `Reconociendo página ${pageNumber} de ${pdf.numPages}...`
        );

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.6 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("No se ha podido preparar la imagen de la página.");
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
          canvasContext: context,
          viewport
        }).promise;

        const result = await worker.recognize(canvas);
        const recognizedText = (result.data.text || "").trim();

        if (recognizedText.length > 0) {
          recognized++;

          const { error: saveError } = await supabase
            .from("book_pages")
            .upsert(
              {
                user_id: (await supabase.auth.getUser()).data.user.id,
                book_id: book.id,
                page_number: pageNumber,
                content: recognizedText
              },
              { onConflict: "book_id,page_number" }
            );

          if (saveError) throw saveError;
        }

        processed++;
        setProgressValue(
          Math.round((processed / pagesToRead.length) * 100)
        );

        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }

      const { error: updateError } = await supabase
        .from("books")
        .update({
          processing_status: recognized > 0 ? "ready" : "needs_ocr",
          processing_error: null,
          page_count: pdf.numPages
        })
        .eq("id", book.id);

      if (updateError) throw updateError;

      setMessage(
        `OCR terminado. Se han procesado ${processed} páginas y se ha reconocido texto en ${recognized}.`
      );

      await loadBooks();
    } catch (err) {
      setError(err.message || "No se ha podido completar el OCR.");
    } finally {
      if (worker) {
        await worker.terminate();
      }

      if (pdf) {
        await pdf.destroy();
      }

      setActiveBook(null);
      setProgress("");
    }
  }

  return (
    <section className="ocr-page">
      <div className="eyebrow">LECTURA INTELIGENTE</div>
      <h1>OCR de libros escaneados</h1>
      <p className="ocr-intro">
        Reconoce el texto de las páginas que están escaneadas como imágenes
        para incorporarlas a tu biblioteca.
      </p>

      <div className="ocr-notice">
        <ScanText size={19} />
        <p>
          El reconocimiento se realiza en tu navegador. La primera vez se
          descargarán los datos de idioma español e inglés. El proceso puede
          tardar bastante en libros grandes.
        </p>
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

      {activeBook && (
        <div className="ocr-progress-panel">
          <div className="ocr-progress-heading">
            <LoaderCircle className="spin" size={18} />
            <span>{progress}</span>
          </div>
          <div className="ocr-progress-track">
            <div
              className="ocr-progress-fill"
              style={{ width: `${progressValue}%` }}
            />
          </div>
          <span className="ocr-progress-number">{progressValue}%</span>
        </div>
      )}

      <div className="ocr-list-heading">
        <h2>Tus libros</h2>
        <button
          className="outline-button"
          onClick={loadBooks}
          disabled={loading || !!activeBook}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="library-empty">
          <LoaderCircle className="spin" />
          Cargando libros...
        </div>
      ) : books.length === 0 ? (
        <div className="library-empty">
          <FileText size={26} />
          <h3>Aún no tienes libros</h3>
          <p>Primero importa un PDF desde Mi biblioteca.</p>
        </div>
      ) : (
        <div className="ocr-book-list">
          {books.map((book) => (
            <article className="ocr-book-card" key={book.id}>
              <div className="ocr-book-icon">
                <FileText size={23} />
              </div>

              <div className="ocr-book-info">
                <h3>{book.title}</h3>
                <p>
                  {book.page_count
                    ? `${book.page_count} páginas`
                    : "Número de páginas pendiente"}
                </p>
                <span>
                  {book.processing_status === "ready"
                    ? "Texto disponible"
                    : book.processing_status === "needs_ocr"
                      ? "Puede necesitar reconocimiento OCR"
                      : "Pendiente de lectura"}
                </span>
              </div>

              <button
                className="outline-button ocr-action"
                onClick={() => runOCR(book)}
                disabled={!!activeBook}
              >
                {activeBook === book.id ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Play size={15} />
                )}
                {activeBook === book.id ? "Procesando" : "Reconocer páginas"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
