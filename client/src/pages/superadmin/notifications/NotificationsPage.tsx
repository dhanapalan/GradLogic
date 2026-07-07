import { useState, useEffect } from "react";
import { PlusIcon, EnvelopeIcon, BellIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import notificationService, { Announcement, EmailTemplate } from "../../../services/notificationService";

export default function NotificationsPage() {
  const [tab, setTab] = useState<"announcements" | "templates">("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    message: "",
    type: "info" as const,
  });

  useEffect(() => {
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

    loadData();
  }, []);

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    try {
      const announcement = await notificationService.createAnnouncement(
        newAnnouncement.title,
        newAnnouncement.message,
        newAnnouncement.type
      );
      setAnnouncements([announcement, ...announcements]);
      setNewAnnouncement({ title: "", message: "", type: "info" });
      setShowAnnouncementForm(false);
      toast.success("Announcement created!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create announcement");
      console.error(error);
    }
  };

  const handleToggleAnnouncement = async (ann: Announcement) => {
    try {
      if (ann.active) {
        await notificationService.deactivateAnnouncement(ann.id);
        setAnnouncements(announcements.map((a) => (a.id === ann.id ? { ...a, active: false } : a)));
        toast.success("Announcement deactivated");
      } else {
        await notificationService.activateAnnouncement(ann.id);
        setAnnouncements(announcements.map((a) => (a.id === ann.id ? { ...a, active: true } : a)));
        toast.success("Announcement activated");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Action failed");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Notifications</h2>
        <p className="text-gray-600 mt-1">Manage system announcements and email templates</p>
      </div>

      {/* Tabs */}
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

      {/* Announcements Tab */}
      {tab === "announcements" && (
        loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">Loading announcements...</p>
          </div>
        ) : (
          <div className="space-y-6">
          {/* Add Announcement Form */}
          {showAnnouncementForm && (
            <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Announcement</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    placeholder="Announcement title"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                  <textarea
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                    placeholder="Announcement message"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newAnnouncement.type}
                    onChange={(e) =>
                      setNewAnnouncement({
                        ...newAnnouncement,
                        type: e.target.value as any,
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
                    onClick={handleAddAnnouncement}
                    className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowAnnouncementForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Announcements List */}
          {!showAnnouncementForm && (
            <button
              onClick={() => setShowAnnouncementForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              New Announcement
            </button>
          )}

          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{ann.title}</h3>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          ann.type === "info"
                            ? "bg-navy-900/[0.06] text-navy-900"
                            : ann.type === "warning"
                              ? "bg-yellow-100 text-yellow-800"
                              : ann.type === "success"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
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
                  <button
                    onClick={() => handleToggleAnnouncement(ann)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      ann.active
                        ? "border-red-300 text-red-700 hover:bg-red-50"
                        : "border-green-300 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {ann.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )
      )}

      {/* Email Templates Tab */}
      {tab === "templates" && (
        loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">Loading email templates...</p>
          </div>
        ) : (
          <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-600">Subject: {template.subject}</p>
                </div>
                <button className="p-2 text-admin-accent hover:text-admin-accent hover:bg-navy-900/[0.04] rounded-lg transition-colors">
                  Edit
                </button>
              </div>

              {template.variables.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Available Variables:</p>
                  <div className="flex flex-wrap gap-2">
                    {template.variables.map((v) => (
                      <span
                        key={v}
                        className="text-xs px-3 py-1 bg-gray-200 text-gray-800 rounded font-mono"
                      >
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
        )
      )}
    </div>
  );
}
