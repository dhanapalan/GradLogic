// =============================================================================
// TalentSecure AI — Online Coding Editor with Auto-Graded Validation
// =============================================================================
// Live coding environment using a textarea-based code editor with syntax
// theme. Supports running code, submitting against hidden test cases,
// and auto-grading via Judge0 backend.
// =============================================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import clsx from "clsx";
import api from "../../lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface TestCaseResult {
  testCaseIndex: number;
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  passed: boolean;
  status: string;
  time: string | null;
  memory: number | null;
  error: string | null;
}

interface ExecutionReport {
  language: string;
  totalTestCases: number;
  passed: number;
  failed: number;
  score: number;
  testResults: TestCaseResult[];
  compilationError: string | null;
}

interface RunResult {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
}

interface SupportedLanguage {
  id: string;
  name: string;
  judge0Id: number;
}

interface CodingProblem {
  title: string;
  description: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  hiddenTestCases: { input: string; expectedOutput: string }[];
  starterCode: Record<string, string>;
  marks: number;
  timeLimitMs: number;
  memoryLimitKb: number;
}

interface CodeEditorProps {
  problem?: CodingProblem;
  onSubmitScore?: (score: number, totalMarks: number) => void;
}

// ── Default problem for standalone usage ─────────────────────────────────────

const DEFAULT_PROBLEM: CodingProblem = {
  title: "Two Sum",
  description: `Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Return the answer as two space-separated indices (0-based).`,
  constraints:
    "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
  sampleInput: "4\n2 7 11 15\n9",
  sampleOutput: "0 1",
  hiddenTestCases: [
    { input: "4\n2 7 11 15\n9", expectedOutput: "0 1" },
    { input: "3\n3 2 4\n6", expectedOutput: "1 2" },
    { input: "2\n3 3\n6", expectedOutput: "0 1" },
  ],
  starterCode: {
    python:
      '# Read input and solve the Two Sum problem\nn = int(input())\nnums = list(map(int, input().split()))\ntarget = int(input())\n\n# Your code here\nfor i in range(n):\n    for j in range(i+1, n):\n        if nums[i] + nums[j] == target:\n            print(i, j)\n            break\n',
    javascript:
      "// Read input from stdin\nconst readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on('line', (line) => lines.push(line));\nrl.on('close', () => {\n  const n = parseInt(lines[0]);\n  const nums = lines[1].split(' ').map(Number);\n  const target = parseInt(lines[2]);\n  \n  // Your code here\n  for (let i = 0; i < n; i++) {\n    for (let j = i + 1; j < n; j++) {\n      if (nums[i] + nums[j] === target) {\n        console.log(i + ' ' + j);\n        return;\n      }\n    }\n  }\n});\n",
    cpp:
      '#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    vector<int> nums(n);\n    for (int i = 0; i < n; i++) cin >> nums[i];\n    int target;\n    cin >> target;\n    \n    // Your code here\n    for (int i = 0; i < n; i++) {\n        for (int j = i+1; j < n; j++) {\n            if (nums[i] + nums[j] == target) {\n                cout << i << " " << j << endl;\n                return 0;\n            }\n        }\n    }\n    return 0;\n}\n',
  },
  marks: 10,
  timeLimitMs: 5000,
  memoryLimitKb: 262144,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function CodeEditor({
  problem = DEFAULT_PROBLEM,
  onSubmitScore,
}: CodeEditorProps) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(problem.starterCode?.python || "");
  const [customInput, setCustomInput] = useState(problem.sampleInput);
  const [activeTab, setActiveTab] = useState<"problem" | "output" | "results">(
    "problem",
  );
  const [runOutput, setRunOutput] = useState<RunResult | null>(null);
  const [testReport, setTestReport] = useState<ExecutionReport | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Phase-1 Coding Assessments: Python & Java only
  const { data: languages } = useQuery({
    queryKey: ["supported-languages", "phase1-coding"],
    queryFn: async () => {
      const { data } = await api.get("/exams/languages");
      const all = (data.data || []) as SupportedLanguage[];
      return all.filter((l) => l.id === "python" || l.id === "java");
    },
  });

  // Update code when language changes
  useEffect(() => {
    if (problem.starterCode?.[language]) {
      setCode(problem.starterCode[language]);
    }
  }, [language, problem.starterCode]);

  // ── Tab key handling in textarea ──────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newCode = code.slice(0, start) + "    " + code.slice(end);
        setCode(newCode);
        // Move cursor to after the inserted tab
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 4;
        }, 0);
      }
    },
    [code],
  );

  // ── Run Code (single execution) ───────────────────────────────────────────

  const runMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/exams/execute-code", {
        sourceCode: code,
        language,
        stdin: customInput,
      });
      return data.data as RunResult;
    },
    onSuccess: (data) => {
      setRunOutput(data);
      setActiveTab("output");
      if (data.status.id === 3) {
        toast.success("Code executed successfully");
      } else if (data.compileOutput) {
        toast.error("Compilation error");
      } else {
        toast.error(`Execution: ${data.status.description}`);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Execution failed");
    },
  });

  // ── Submit (run against hidden test cases) ────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/exams/run-tests", {
        sourceCode: code,
        language,
        testCases: problem.hiddenTestCases,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitKb: problem.memoryLimitKb,
      });
      return data.data as ExecutionReport;
    },
    onSuccess: (data) => {
      setTestReport(data);
      setActiveTab("results");
      if (data.score === 100) {
        toast.success(`All test cases passed! Score: ${data.score}%`);
      } else {
        toast(`Passed ${data.passed}/${data.totalTestCases} test cases`, {
          icon: "📊",
        });
      }
      if (onSubmitScore) {
        const earnedMarks = Math.round((data.score / 100) * problem.marks);
        onSubmitScore(earnedMarks, problem.marks);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Submission failed");
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-[700px] bg-gray-900 text-gray-100 rounded-xl overflow-hidden border border-gray-700">
      {/* ── Top toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-gray-200">
            {problem.title}
          </h3>
          <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
            {problem.marks} marks
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-sm bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500"
          >
            {(languages || [
              { id: "python", name: "Python" },
              { id: "javascript", name: "JavaScript" },
              { id: "cpp", name: "C++" },
              { id: "java", name: "Java" },
              { id: "c", name: "C" },
              { id: "go", name: "Go" },
              { id: "rust", name: "Rust" },
              { id: "typescript", name: "TypeScript" },
            ]).map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>

          {/* Font size */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontSize((s) => Math.max(10, s - 1))}
              className="text-xs text-gray-400 hover:text-gray-200 px-1"
            >
              A-
            </button>
            <span className="text-xs text-gray-500">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(24, s + 1))}
              className="text-xs text-gray-400 hover:text-gray-200 px-1"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content: split pane ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Problem + Output tabs */}
        <div className="w-2/5 flex flex-col border-r border-gray-700">
          {/* Tab bar */}
          <div className="flex bg-gray-800 border-b border-gray-700">
            {(["problem", "output", "results"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-4 py-2 text-sm font-medium capitalize transition-colors",
                  activeTab === tab
                    ? "text-blue-400 border-b-2 border-blue-400 bg-gray-900"
                    : "text-gray-400 hover:text-gray-200",
                )}
              >
                {tab}
                {tab === "results" && testReport && (
                  <span
                    className={clsx(
                      "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                      testReport.score === 100
                        ? "bg-green-900 text-green-300"
                        : "bg-yellow-900 text-yellow-300",
                    )}
                  >
                    {testReport.score}%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Problem description */}
            {activeTab === "problem" && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-100">
                  {problem.title}
                </h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {problem.description}
                </p>

                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-xs font-semibold text-amber-400 mb-1">
                    Constraints
                  </p>
                  <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                    {problem.constraints}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs font-semibold text-green-400 mb-1">
                      Sample Input
                    </p>
                    <pre className="text-xs text-gray-300 font-mono">
                      {problem.sampleInput}
                    </pre>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs font-semibold text-green-400 mb-1">
                      Sample Output
                    </p>
                    <pre className="text-xs text-gray-300 font-mono">
                      {problem.sampleOutput}
                    </pre>
                  </div>
                </div>

                {/* Custom input */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-1">
                    Custom Input (stdin)
                  </p>
                  <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    rows={4}
                    className="w-full text-xs font-mono bg-gray-800 text-gray-300 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Run output */}
            {activeTab === "output" && (
              <div className="space-y-3">
                {runOutput ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "text-xs font-medium px-2 py-0.5 rounded",
                          runOutput.status.id === 3
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-300",
                        )}
                      >
                        {runOutput.status.description}
                      </span>
                      {runOutput.time && (
                        <span className="text-xs text-gray-500">
                          {runOutput.time}s
                        </span>
                      )}
                      {runOutput.memory && (
                        <span className="text-xs text-gray-500">
                          {(runOutput.memory / 1024).toFixed(1)}MB
                        </span>
                      )}
                    </div>

                    {runOutput.stdout && (
                      <div>
                        <p className="text-xs font-semibold text-green-400 mb-1">
                          stdout
                        </p>
                        <pre className="text-xs font-mono bg-gray-800 text-gray-300 p-3 rounded-lg border border-gray-700 whitespace-pre-wrap">
                          {runOutput.stdout}
                        </pre>
                      </div>
                    )}

                    {runOutput.stderr && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 mb-1">
                          stderr
                        </p>
                        <pre className="text-xs font-mono bg-red-950/50 text-red-300 p-3 rounded-lg border border-red-900 whitespace-pre-wrap">
                          {runOutput.stderr}
                        </pre>
                      </div>
                    )}

                    {runOutput.compileOutput && (
                      <div>
                        <p className="text-xs font-semibold text-amber-400 mb-1">
                          Compilation Output
                        </p>
                        <pre className="text-xs font-mono bg-amber-950/50 text-amber-300 p-3 rounded-lg border border-amber-900 whitespace-pre-wrap">
                          {runOutput.compileOutput}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Run your code to see output here.
                  </p>
                )}
              </div>
            )}

            {/* Test results */}
            {activeTab === "results" && (
              <div className="space-y-3">
                {testReport ? (
                  <>
                    {/* Summary */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-200">
                          Score
                        </span>
                        <span
                          className={clsx(
                            "text-xl font-bold",
                            testReport.score === 100
                              ? "text-green-400"
                              : testReport.score >= 50
                              ? "text-yellow-400"
                              : "text-red-400",
                          )}
                        >
                          {testReport.score}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            "h-full rounded-full transition-all",
                            testReport.score === 100
                              ? "bg-green-500"
                              : testReport.score >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500",
                          )}
                          style={{ width: `${testReport.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Passed {testReport.passed} of {testReport.totalTestCases}{" "}
                        test cases
                      </p>
                    </div>

                    {/* Compilation error */}
                    {testReport.compilationError && (
                      <div className="bg-red-950/50 rounded-lg p-3 border border-red-900">
                        <p className="text-xs font-semibold text-red-400 mb-1">
                          Compilation Error
                        </p>
                        <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap">
                          {testReport.compilationError}
                        </pre>
                      </div>
                    )}

                    {/* Individual test cases */}
                    {testReport.testResults.map((tc) => (
                      <div
                        key={tc.testCaseIndex}
                        className={clsx(
                          "rounded-lg p-3 border",
                          tc.passed
                            ? "bg-green-950/30 border-green-900"
                            : "bg-red-950/30 border-red-900",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-300">
                            Test Case {tc.testCaseIndex + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            {tc.time && (
                              <span className="text-xs text-gray-500">
                                {tc.time}s
                              </span>
                            )}
                            <span
                              className={clsx(
                                "text-xs font-medium px-2 py-0.5 rounded",
                                tc.passed
                                  ? "bg-green-900 text-green-300"
                                  : "bg-red-900 text-red-300",
                              )}
                            >
                              {tc.passed ? "Passed" : "Failed"}
                            </span>
                          </div>
                        </div>
                        {!tc.passed && tc.error && (
                          <pre className="text-xs font-mono text-red-300 mt-1">
                            {tc.error}
                          </pre>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Submit your code to run against test cases.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Code editor */}
        <div className="flex-1 flex flex-col">
          {/* Editor area */}
          <div className="flex-1 relative">
            {/* Line numbers + editor */}
            <div className="absolute inset-0 flex">
              {/* Line numbers */}
              <div className="w-12 bg-gray-850 border-r border-gray-700 overflow-hidden">
                <div
                  className="pt-2 pr-2 text-right font-mono text-gray-600 select-none"
                  style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
                >
                  {code.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
              </div>

              {/* Textarea editor */}
              <textarea
                ref={editorRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="flex-1 bg-gray-900 text-gray-100 font-mono p-2 resize-none outline-none border-none focus:ring-0"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: "1.5",
                  tabSize: 4,
                }}
              />
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-t border-gray-700">
            <div className="text-xs text-gray-500">
              {language.charAt(0).toUpperCase() + language.slice(1)} •{" "}
              {code.split("\n").length} lines
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending || !code.trim()}
                className={clsx(
                  "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                  runMutation.isPending || !code.trim()
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-gray-700 text-gray-200 hover:bg-gray-600",
                )}
              >
                {runMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Running…
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Run Code
                  </>
                )}
              </button>

              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !code.trim()}
                className={clsx(
                  "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                  submitMutation.isPending || !code.trim()
                    ? "bg-green-900 text-green-600 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-500",
                )}
              >
                {submitMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Submitting…
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
