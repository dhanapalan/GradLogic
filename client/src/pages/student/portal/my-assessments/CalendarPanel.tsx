import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import studentAssessmentsHubService from "../../../../services/studentAssessmentsHubService";
import { EmptyBlock, ErrorBlock, LoadingBlock, formatWhen } from "./components";

export default function CalendarPanel() {
  const q = useQuery({
    queryKey: ["assessments-calendar"],
    queryFn: () => studentAssessmentsHubService.getCalendar(60),
    staleTime: 60_000,
  });

  if (q.isLoading) return <LoadingBlock label="Loading calendar" />;
  if (q.isError) return <ErrorBlock message="Couldn’t load assessment calendar." onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyBlock title="No assessment events in the next 60 days" />;

  const byDay = new Map<string, typeof q.data>();
  for (const e of q.data) {
    const day = e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "Unscheduled";
    const list = byDay.get(day) || [];
    list.push(e);
    byDay.set(day, list);
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-labelledby="cal-heading">
      <h2 id="cal-heading" className="mb-3 text-sm font-black text-slate-900">
        Assessment calendar
      </h2>
      <ul className="space-y-3">
        {[...byDay.entries()].map(([day, events]) => (
          <li key={day}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{day}</p>
            <ul className="mt-1 space-y-1">
              {events.map((e) => (
                <li key={e.id}>
                  <Link
                    to={e.href}
                    className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="text-xs font-bold text-slate-800">{e.title}</span>
                    <span className="text-[10px] text-slate-400">{formatWhen(e.starts_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
