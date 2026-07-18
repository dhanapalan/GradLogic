import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Copy } from "lucide-react";
import collegeService, { CreateCollegeResult } from "../../../services/collegeService";

interface CollegeFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  tpoName: string;
  tpoEmail: string;
  studentLimit: number;
}

export default function AddCollegePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreateCollegeResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState<CollegeFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    tpoName: "",
    tpoEmail: "",
    studentLimit: 100,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "studentLimit" ? parseInt(value) : value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error("College name is required");
      return false;
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Invalid college email");
      return false;
    }
    if (!/^\+?\d{10,15}$/.test(formData.phone.replace(/[\s\-()]/g, ""))) {
      toast.error("Enter a valid phone number (10-15 digits)");
      return false;
    }
    if (!formData.address.trim()) {
      toast.error("Address is required");
      return false;
    }
    if (!formData.tpoName.trim()) {
      toast.error("TPO name is required");
      return false;
    }
    if (!formData.tpoEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Invalid TPO email");
      return false;
    }
    if (!formData.city.trim() || !formData.state.trim()) {
      toast.error("City and State are required");
      return false;
    }
    if (formData.studentLimit < 10) {
      toast.error("Student limit must be at least 10");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await collegeService.createCollege(formData);
      toast.success("College added successfully!");
      // Show the one-time TPO password instead of navigating away immediately —
      // it's never retrievable again after this response.
      setCreated(result);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add college");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.temporary_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the password manually");
    }
  };

  if (created) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">College created</h2>
          <p className="text-gray-500 mt-1">
            Save the TPO's login below now — the password can't be shown again after you leave this page.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-8 space-y-6">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">College</div>
            <div className="text-lg font-semibold text-gray-900">{created.name}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">TPO Name</div>
              <div className="text-gray-900">{created.tpo_name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Login Email</div>
              <div className="text-gray-900">{created.tpo_email}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Temporary Password</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono text-gray-900">
                {created.temporary_password}
              </code>
              <button
                type="button"
                onClick={copyPassword}
                className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                title="Copy password"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              They'll be required to set a new password on first login.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={() => navigate("/app/superadmin/colleges")}
              className="px-6 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
            >
              Done — Go to Colleges
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Add New College</h2>
        <p className="text-gray-500 mt-1">Register a new college on the platform.</p>
      </div>

      <div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-8 space-y-6">
          {/* College Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">College Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">College Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., MIT College of Engineering"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@college.edu"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Bangalore"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Karnataka"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TPO Information */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Training & Placement Officer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TPO Name *</label>
                <input
                  type="text"
                  name="tpoName"
                  value={formData.tpoName}
                  onChange={handleChange}
                  placeholder="Dr. Rajesh Kumar"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TPO Email *</label>
                <input
                  type="email"
                  name="tpoEmail"
                  value={formData.tpoEmail}
                  onChange={handleChange}
                  placeholder="tpo@college.edu"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Limit per Year *</label>
              <input
                type="number"
                name="studentLimit"
                value={formData.studentLimit}
                onChange={handleChange}
                min="10"
                max="10000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum students that can be registered from this college</p>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 pt-6 flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/app/superadmin/colleges")}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create College"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
