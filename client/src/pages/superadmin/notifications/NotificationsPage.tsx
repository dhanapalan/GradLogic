import { useState, useEffect } from "react";
import { PlusIcon, EnvelopeIcon, BellIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import notificationService, { Announcement, EmailTemplate } from "../../../services/notificationService";

type AnnouncementType = "info" | "warning" | "success" | "error";

const emptyAnnouncement = { title: "", message: "", type: "info" as AnnouncementType };
const emptyTemplate = { name: "", subject: "", body: "", variables: "" };

export default function NotificationsPage() {
  const [tab, setTab] = useState<"announcements" | "templates">("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement);

  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);

  const loadData = async () => {
    setLoading(true);
    try {
      const [announcementData, templateData] = await Promise.all([
        notificationService.getAnnouncements(),
        notificationService.getEmailTemplates(),
      ]);
      setAnnouncements(announcementData);
      setTemplates(templateData);
    } catch (error) {
      toast.error("Failed to load notifications");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreateAnnouncement = () => {
    setEditingAnnouncementId(null);
    setAnnouncementForm(emptyAnnouncement);
    setShowAnnouncementForm(true);
  };

  const openEditAnnouncement = (ann: Announcement) => {
    setEditingAnnouncementId(ann.id);
    setAnnouncementForm({
      title: ann.title,
      message: ann.message,
      type: ann.type,
    });
    setShowAnnouncementForm(true);
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    try {
      if (editingAnnouncementId) {
        await notificationService.updateAnnouncement(editingAnnouncementId, announcementForm);
        toast.success("Announcement updated");
      } else {
        await notificationService.createAnnouncement(
          announcementForm.title,
          announcementForm.message,
          announcementForm.type
        );
        toast.success("Announcement created");
      }
      setShowAnnouncementForm(false);
      setEditingAnnouncementId(null);
      setAnnouncementForm(emptyAnnouncement);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save announcement");
    }
  };

  const handleSoftDeleteAnnouncement = async (id: string) => {
    if (!confirm("Soft-delete this announcement?")) return;
    try {
      await notificationService.deactivateAnnouncement(id);
      toast.success("Announcement deleted");
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Delete failed");
    }
  };

  const handleToggleAnnouncement = async (ann: Announcement) => {
    try {
      if (ann.active) {
        await notificationService.updateAnnouncement(ann.id, { active: false });
        toast.success("Announcement deactivated");
      } else {
        await notificationService.activateAnnouncement(ann.id);
        toast.success("Announcement activated");
      }
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Action failed");
    }
  };

  const openCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplate);
    setShowTemplateForm(true);
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditingTemplateId(t.id);
    setTemplateForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      variables: (t.variables || []).join(", "),
    });
    setShowTemplateForm(true);
  };

  const parseVariables = (raw: string) =>
    raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.subject.trim() || !templateForm.body.trim()) {
      toast.error("Name, subject, and body are required");
      return;
    }
    const variables = parseVariables(templateForm.variables);
    try {
      if (editingTemplateId) {
        await notificationService.updateEmailTemplate(editingTemplateId, {
          name: templateForm.name,
          subject: templateForm.subject,
          body: templateForm.body,
          variables,
        });
        toast.success("Template updated");
      } else {
        await notificationService.createEmailTemplate(
          templateForm.name,
          templateForm.subject,
          templateForm.body,
          variables
        );
        toast.success("Template created");
      }
      setShowTemplateForm(false);
      setEditingTemplateId(null);
      setTemplateForm(emptyTemplate);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save template");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Soft-delete this email template?")) return;
    try {
      await notificationService.deleteEmailTemplate(id);
      toast.success("Template deleted");
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Notifications</h2>
        <p className="text-gray-600 mt-1">Manage system announcements and email templates</p>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab("announcements")}
          className={`pb-3 px-4 font-medium transition-colors ${
            tab === "announcements"
              ? "text-admin-accent border-b-2 border-admin-accent"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <BellIcon className="w-5 h-5" />
            Announcements ({announcements.length})
          </div>
        </button>
        <button
          onClick={() => setTab("templates")}
          className={`pb-3 px-4 font-medium transition-colors ${
            tab === "templates"
              ? "text-admin-accent border-b-2 border-admin-accent"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5" />
            Email Templates ({templates.length})
          </div>
        </button>
      </div>

      {tab === "announcements" &&
        (loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">Loading announcements...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {showAnnouncementForm && (
              <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingAnnouncementId ? "Edit Announcement" : "Create Announcement"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                    <textarea
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={announcementForm.type}
                      onChange={(e) =>
                        setAnnouncementForm({
                          ...announcementForm,
                          type: e.target.value as AnnouncementType,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="success">Success</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAnnouncement}
                      className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
                    >
                      {editingAnnouncementId ? "Save" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAnnouncementForm(false);
                        setEditingAnnouncementId(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!showAnnouncementForm && (
              <button
                onClick={openCreateAnnouncement}
                className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                New Announcement
              </button>
            )}

            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">{ann.title}</h3>
                        <span className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-800">
                          {ann.type}
                        </span>
                        {ann.active && (
                          <span className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 mt-2">{ann.message}</p>
                      <p className="text-xs text-gray-500 mt-2">Created: {ann.createdAt}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => openEditAnnouncement(ann)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleAnnouncement(ann)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                          ann.active
                            ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                            : "border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {ann.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleSoftDeleteAnnouncement(ann.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      {tab === "templates" &&
        (loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">Loading email templates...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {showTemplateForm && (
              <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingTemplateId ? "Edit Email Template" : "Create Email Template"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                    <input
                      type="text"
                      value={templateForm.subject}
                      onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
                    <textarea
                      value={templateForm.body}
                      onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Variables (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={templateForm.variables}
                      onChange={(e) => setTemplateForm({ ...templateForm, variables: e.target.value })}
                      placeholder="student_name, login_url"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTemplate}
                      className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
                    >
                      {editingTemplateId ? "Save" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowTemplateForm(false);
                        setEditingTemplateId(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!showTemplateForm && (
              <button
                onClick={openCreateTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
              >
                <PlusIcon className="w-5 h-5" />
                New Email Template
              </button>
            )}

            {templates.map((template) => (
              <div key={template.id} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-600">Subject: {template.subject}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditTemplate(template)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>

                {(template.variables || []).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Available Variables:</p>
                    <div className="flex flex-wrap gap-2">
                      {template.variables.map((v) => (
                        <span key={v} className="text-xs px-3 py-1 bg-gray-200 text-gray-800 rounded font-mono">
                          {"{" + v + "}"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{template.body}</p>
                </div>
                <p className="text-xs text-gray-500">Created: {template.createdAt}</p>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
