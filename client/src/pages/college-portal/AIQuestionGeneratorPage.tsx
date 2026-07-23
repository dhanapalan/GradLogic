/**
 * College Portal AI question generator — prompts the existing RAG-based
 * question engine (server proxy: /api/qb-ai/generate, same one the Super
 * Admin content studio uses) and imports reviewed questions as drafts into
 * this college's own question bank via /campus/questions/ai-import.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import campusQuestionsService, { type AiGeneratedQuestion } from "../../services/campusQuestionsService";

interface GeneratedQuestion extends AiGeneratedQuestion {
  selected: boolean;
}

export default function CollegePortalAIQuestionGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(5);
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);

  const { data: health } = useQuery({
    queryKey: ["qb-ai-health"],
    queryFn: async () => {
      const { data } = await api.get("/qb-ai/health");
      return data.data;
    },
    refetchInterval: 30_000,
  });
  const engineOnline: boolean = !!health?.online;

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post("/qb-ai/generate", {
        topic,
        difficulty,
        question_type: "multiple_choice",
        count,
        use_rag: true,
      }),
    onSuccess: (res: any) => {
      const qs: AiGeneratedQuestion[] = res.data?.data?.questions || [];
      if (!qs.length) {
        toast.error("Engine returned no questions — check its logs");
        return;
      }
      setGenerated(qs.map((q) => ({ ...q, selected: true })));
      toast.success(`Generated ${qs.length} question(s) — review and import`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Generation failed");
    },
  });

  const importMutation = useMutation({
    mutationFn: () => {
      const selected = generated
        .filter((q) => q.selected)
        .map(({ selected: _s, ...q }) => q);
      return campusQuestionsService.aiImport(selected);
    },
    onSuccess: (res) => {
      toast.success(
        `Imported ${res.summary.successful} of ${res.summary.total} as drafts (${res.summary.skipped} duplicate, ${res.summary.failed} failed)`
      );
      setGenerated([]);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Import failed");
    },
  });

  const selectedCount = generated.filter((q) => q.selected).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          to="/app/college-portal/question-bank"
          className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-admin-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Question Bank
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900">
          <Sparkles className="h-6 w-6 text-admin-accent" />
          Generate Questions with AI
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Describe a topic, review the generated questions, and import the ones you want as drafts.
        </p>
        {!engineOnline && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Question engine appears offline. Generation may fail until it's back up.
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prompt</CardTitle>
          <CardDescription>Be specific — "profit and loss word problems" beats "aptitude"</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="Topic, e.g. Time and Work"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="sm:col-span-2"
          />
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
          <Input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
          />
          <Button
            type="button"
            className="sm:col-span-4"
            disabled={!topic.trim() || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? "Generating…" : "Generate"}
          </Button>
        </CardContent>
      </Card>

      {generated.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Review ({selectedCount} selected)</CardTitle>
                <CardDescription>Imported questions land as drafts — review before publishing</CardDescription>
              </div>
              <Button
                type="button"
                disabled={!selectedCount || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? "Importing…" : `Import ${selectedCount}`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {generated.map((q, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 p-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={q.selected}
                    onChange={(e) => {
                      const next = [...generated];
                      next[idx] = { ...q, selected: e.target.checked };
                      setGenerated(next);
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{q.question}</p>
                    {q.options && q.options.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {q.options.map((opt, oi) => (
                          <li
                            key={oi}
                            className={`flex items-center gap-1.5 ${
                              opt.trim() === q.correct_answer?.trim()
                                ? "font-medium text-emerald-700"
                                : "text-gray-600"
                            }`}
                          >
                            {opt.trim() === q.correct_answer?.trim() ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-gray-300" />
                            )}
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
