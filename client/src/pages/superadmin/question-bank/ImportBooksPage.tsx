import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Download } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";
import { BOOK_PACKS, BookPack } from "./bookPacks";

export default function ImportBooksPage() {
  // pack slug -> number of already-imported questions (-1 = unknown/loading)
  const [imported, setImported] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const status: Record<string, number> = {};
      for (const pack of BOOK_PACKS) {
        try {
          status[pack.slug] = await questionBankService.countByTag(pack.slug);
        } catch {
          status[pack.slug] = -1;
        }
      }
      setImported(status);
    };
    check();
  }, []);

  const handleImport = async (pack: BookPack) => {
    setImporting(pack.slug);
    try {
      const questions = pack.questions.map((q) => ({
        ...q,
        type: "multiple_choice",
        tags: ["book-import", pack.slug, ...(q.tags || [])],
      }));
      const result = await questionBankService.bulkCreateQuestions(questions);
      toast.success(`Imported ${result.created} questions from ${pack.title}`);
      setImported((s) => ({ ...s, [pack.slug]: pack.questions.length }));
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Import failed");
      console.error(error);
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Import from Books</h2>
        <p className="text-gray-500 mt-1">
          Seed the question bank with curated packs modeled on standard campus-prep reference books.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {BOOK_PACKS.map((pack) => {
          const count = imported[pack.slug];
          const done = count !== undefined && count > 0;
          return (
            <div key={pack.slug} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className={`rounded-lg p-2 ${pack.color}`}>
                  <BookOpen className="w-6 h-6" />
                </div>
                {done && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    Imported
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900">{pack.title}</h3>
              <p className="text-sm text-gray-600 mt-1 flex-1">{pack.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span className="capitalize">{pack.category.replace(/_/g, " ")}</span>
                <span>•</span>
                <span>{pack.questions.length} questions</span>
              </div>
              <button
                onClick={() => handleImport(pack)}
                disabled={importing === pack.slug || done}
                className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {importing === pack.slug
                  ? "Importing..."
                  : done
                    ? "Already Imported"
                    : "Import Pack"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-navy-900/[0.04] border border-navy-900/10 rounded-xl p-4 text-sm text-navy-900">
        Imported questions are tagged <code className="bg-navy-900/10 px-1 rounded">book-import</code>{" "}
        and appear immediately in{" "}
        <a href="/app/superadmin/question-bank" className="underline font-medium">
          All Questions
        </a>
        . For generating questions from your own PDFs or books, use the{" "}
        <a href="/app/superadmin/question-bank/ai-generator" className="underline font-medium">
          AI Question Generator
        </a>
        .
      </div>
    </div>
  );
}
