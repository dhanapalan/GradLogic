import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, ClipboardList, FileText, ExternalLink } from "lucide-react";
import studentLearningService from "../../../../services/studentLearningService";
import { BASE, EmptyBlock, LoadingBlock, StatusPill } from "./components";

/** Lazy-loaded lower dashboard panels: assessments, certificates, resources. */
export default function HeavyPanels() {
  const assessmentsQ = useQuery({
    queryKey: ["learning-assessments"],
    queryFn: () => studentLearningService.getAssessments(),
    staleTime: 45_000,
  });
  const certsQ = useQuery({
    queryKey: ["learning-certificates"],
    queryFn: () => studentLearningService.getCertificates(),
    staleTime: 60_000,
  });
  const resourcesQ = useQuery({
    queryKey: ["learning-resources"],
    queryFn: () => studentLearningService.getResources(),
    staleTime: 60_000,
  });
  const assignmentsQ = useQuery({
    queryKey: ["learning-assignments"],
    queryFn: () => studentLearningService.getAssignments(),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <section aria-labelledby="assess-heading">
        <h2 id="assess-heading" className="mb-3 inline-flex items-center gap-2 text-sm font-black text-slate-900">
          <ClipboardList className="h-4 w-4 text-indigo-500" /> Course Assessments
        </h2>
        {assessmentsQ.isLoading ? (
          <LoadingBlock />
        ) : !assessmentsQ.data?.length ? (
          <EmptyBlock title="No assessments linked right now" hint="Assigned assessments appear in My Assessments." />
        ) : (
          <ul className="space-y-2">
            {assessmentsQ.data.slice(0, 5).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-500">
                    {a.availability}
                    {a.attempts_remaining != null ? ` · ${a.attempts_remaining} attempts left` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.can_start ? (
                    <Link
                      to={a.launch_href}
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      Start Assessment
                    </Link>
                  ) : (
                    <Link
                      to={a.result_href}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      View Result
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="assign-heading">
        <h2 id="assign-heading" className="mb-3 text-sm font-black text-slate-900">
          Assignments
        </h2>
        {assignmentsQ.isLoading ? (
          <LoadingBlock />
        ) : !assignmentsQ.data?.length ? (
          <EmptyBlock title="No course assignments" hint="Assignments appear when your college assigns them." />
        ) : (
          <ul className="space-y-2">
            {(assignmentsQ.data as Array<{ id: string; name: string; course_name: string; due_date: string | null; status: string; submission_status: string }>).map(
              (a) => (
                <li key={a.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{a.name}</p>
                    <StatusPill status={a.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {a.course_name}
                    {a.due_date ? ` · Due ${new Date(a.due_date).toLocaleDateString()}` : ""}
                  </p>
                </li>
              )
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby="certs-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="certs-heading" className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
            <Award className="h-4 w-4 text-amber-500" /> Certificates
          </h2>
          <Link to={`${BASE}/certificates`} className="text-xs font-bold text-indigo-600">
            View all
          </Link>
        </div>
        {certsQ.isLoading ? (
          <LoadingBlock />
        ) : !certsQ.data?.length ? (
          <EmptyBlock title="No certificates yet" hint="Complete a course to earn a certificate." />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {certsQ.data.slice(0, 4).map((c) => (
              <li key={c.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">{c.title || c.course_title}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {c.issue_date ? new Date(c.issue_date).toLocaleDateString() : "—"} · ID {c.certificate_id?.slice(0, 8)}
                </p>
                <Link
                  to={`/app/certificate/${c.id}`}
                  className="mt-2 inline-flex text-xs font-bold text-indigo-600 hover:underline"
                >
                  View / Download
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="resources-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="resources-heading" className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
            <FileText className="h-4 w-4 text-indigo-500" /> Learning Resources
          </h2>
          <Link to={`${BASE}/resources`} className="text-xs font-bold text-indigo-600">
            Browse all
          </Link>
        </div>
        {resourcesQ.isLoading ? (
          <LoadingBlock />
        ) : !resourcesQ.data?.length ? (
          <EmptyBlock title="No resources available" />
        ) : (
          <ul className="space-y-2">
            {(resourcesQ.data as Array<{ id: string; title: string; type: string; url: string | null; course_title: string }>).slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800">{r.title}</p>
                  <p className="text-[10px] text-slate-400">
                    {r.course_title} · {r.type}
                  </p>
                </div>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <Link to={`${BASE}/lessons/${r.id}`} className="text-xs font-bold text-indigo-600">
                    Preview
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
