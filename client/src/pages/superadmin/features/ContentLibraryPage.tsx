import { useEffect, useState } from "react";
import { Boxes, ClipboardList, Library, Loader2, Plus, Archive } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, {
  type ContentLibraryItem,
  type ContentLibraryType,
} from "../../../services/superadminFeaturesService";
import { EmptyState, PageHeader } from "./FeatureUi";

const META: Record<
  ContentLibraryType,
  { title: string; description: string; icon: typeof Library; placeholder: string }
> = {
  interview_question: {
    title: "Interview Questions",
    description: "Curated interview prompts and model answers.",
    icon: ClipboardList,
    placeholder: "Model answer / guidance…",
  },
  case_study: {
    title: "Case Studies",
    description: "Scenario-based case studies for domain practice.",
    icon: Boxes,
    placeholder: "Case brief and questions…",
  },
  learning_resource: {
    title: "Learning Resources",
    description: "Reading lists, cheat sheets, and reference material.",
    icon: Library,
    placeholder: "Resource content or outline…",
  },
  resource: {
    title: "Resource Library",
    description: "Shared assets and packs for faculty and students.",
    icon: Library,
    placeholder: "Asset description or link notes…",
  },
};

export default function ContentLibraryPage({ contentType }: { contentType: ContentLibraryType }) {
  const meta = META[contentType];
  const Icon = meta.icon;
  const [rows, setRows] = useState<ContentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    superadminFeaturesService
      .listContentLibrary({ content_type: contentType, status: "published" })
      .then(setRows)
      .catch(() => toast.error("Failed to load items"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    setCreating(false);
    setTitle("");
    setBody("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  const create = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      await superadminFeaturesService.createContentLibraryItem({
        content_type: contentType,
        title: title.trim(),
        body: body.trim(),
        category,
      });
      toast.success("Created");
      setCreating(false);
      setTitle("");
      setBody("");
      load();
    } catch {
      toast.error("Create failed");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    try {
      await superadminFeaturesService.archiveContentLibraryItem(id);
      toast.success("Archived");
      load();
    } catch {
      toast.error("Archive failed");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={Icon}
        title={meta.title}
        description={meta.description}
        action={
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        }
      />

      {creating && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={meta.placeholder}
            rows={5}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={create}
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message={`No ${meta.title.toLowerCase()} yet. Add the first one.`} />
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.category} · {item.difficulty}
                  </p>
                  {item.body ? <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">{item.body}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => archive(item.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                  title="Archive"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
