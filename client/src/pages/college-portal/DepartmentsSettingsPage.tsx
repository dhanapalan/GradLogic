/**
 * College-scoped department list management — feeds the department picker
 * on student (and future faculty) forms instead of free text.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import campusDepartmentsService, { type Department } from "../../services/campusDepartmentsService";

export default function DepartmentsSettingsPage() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["campus-departments", { includeInactive: true }],
    queryFn: () => campusDepartmentsService.list(true),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["campus-departments"] });

  const createMutation = useMutation({
    mutationFn: (name: string) => campusDepartmentsService.create(name),
    onSuccess: () => {
      toast.success("Department added");
      setNewName("");
      invalidate();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Could not add department");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; is_active?: boolean } }) =>
      campusDepartmentsService.update(id, updates),
    onSuccess: () => {
      toast.success("Department updated");
      setEditingId(null);
      invalidate();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || "Could not update department");
    },
  });

  const startEdit = (d: Department) => {
    setEditingId(d.id);
    setEditingName(d.name);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      toast.error("Department name is required");
      return;
    }
    updateMutation.mutate({ id: editingId, updates: { name } });
  };

  const toggleActive = (d: Department) => {
    updateMutation.mutate({ id: d.id, updates: { is_active: !d.is_active } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          to="/app/college-portal/settings"
          className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-admin-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Departments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the department list students and faculty are assigned from campus-wide.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Department</CardTitle>
          <CardDescription>Appears immediately in student forms and filters</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name) return;
              createMutation.mutate(name);
            }}
          >
            <Input
              placeholder="e.g. Computer Science"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Departments</CardTitle>
          <CardDescription>{departments.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded bg-gray-100" />
          ) : departments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No departments yet. Add your first one above.
            </p>
          ) : (
            departments.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2"
              >
                {editingId === d.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-800">{d.name}</span>
                    <Badge variant={d.is_active ? "success" : "muted"}>
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => startEdit(d)}>
                      Rename
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(d)}>
                      {d.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
