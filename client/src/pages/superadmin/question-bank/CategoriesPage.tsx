import { useState, useEffect } from "react";
import { Plus, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import questionBankService from "../../../services/questionBankService";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  question_count: number;
  is_active?: boolean;
  topics?: Topic[];
}

interface Topic {
  id: string;
  name: string;
  questionCount: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const data = await questionBankService.getCategories();
        setCategories(data);
      } catch (error) {
        toast.error("Failed to load categories");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      const category = await questionBankService.createCategory(
        newCategory.name,
        newCategory.description
      );
      setCategories([...categories, category]);
      setNewCategory({ name: "", description: "" });
      setShowAddForm(false);
      toast.success("Category added successfully!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add category");
      console.error(error);
    }
  };

  const handleDeactivateCategory = async (id: string) => {
    if (!confirm("Deactivate this category? It can be reactivated later.")) return;
    try {
      await questionBankService.deactivateCategory(id);
      setCategories(categories.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
      toast.success("Category deactivated");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to deactivate category");
    }
  };

  const handleActivateCategory = async (id: string) => {
    try {
      await questionBankService.updateCategory(id, { is_active: true });
      setCategories(categories.map((c) => (c.id === id ? { ...c, is_active: true } : c)));
      toast.success("Category activated");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to activate category");
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm({ name: category.name, description: category.description || "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const updated = await questionBankService.updateCategory(editingId, editForm);
      setCategories(categories.map((c) => (c.id === editingId ? { ...c, ...updated } : c)));
      setEditingId(null);
      toast.success("Category updated");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update category");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Categories & Topics</h2>
          <p className="text-gray-500 mt-1">Manage question taxonomy and topics.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Add Category Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Category</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Aptitude, Reasoning, Technical"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Brief description of this category"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {loading ? (
        <div className="p-12 text-center">
          <p className="text-gray-600">Loading categories...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
          <div key={category.id} className={`bg-white rounded-xl shadow-admin-card border p-6 ${category.is_active === false ? "border-gray-200/70 opacity-75" : "border-gray-200/70"}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                {editingId === category.id ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg font-semibold"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1.5 bg-navy-900 text-white rounded-lg text-sm">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-900">{category.name}</h3>
                      {category.is_active === false && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Inactive</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                    <p className="text-xs text-gray-500 mt-2">{category.question_count ?? 0} questions</p>
                  </>
                )}
              </div>
              {editingId !== category.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(category)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {category.is_active === false ? (
                    <button
                      onClick={() => handleActivateCategory(category.id)}
                      className="px-3 py-1.5 text-sm text-green-700 border border-green-300 rounded-lg hover:bg-green-50"
                    >
                      Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeactivateCategory(category.id)}
                      className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Topics */}
            {(category.topics?.length ?? 0) > 0 && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Topics ({category.topics!.length})</h4>
                <div className="grid grid-cols-2 gap-3">
                  {category.topics!.map((topic) => (
                    <div key={topic.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{topic.name}</p>
                        <p className="text-xs text-gray-500">{topic.questionCount} questions</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          ))}
        </div>
      )}
    </div>
  );
}
