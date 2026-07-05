import { useState } from "react";
import {
  PaperAirplaneIcon,
  MegaphoneIcon,
  UsersIcon,
  EnvelopeIcon,
  SparklesIcon,
  ClockIcon,
  CheckBadgeIcon
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

export default function CollegeCommunicationsPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [sendEmail, setSendEmail] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Template pre-fill
  const loadTemplate = () => {
    setSubject("🚀 New AI Mastery Program - Enroll Today!");
    setMessage(`Hello Student,

We are excited to announce a new Skill Development Program: "AI Mastery". Based on your current profile, taking this program will significantly boost your Employability Index and make you stand out to top recruiters.

Module Highlights:
- GenAI Fundamentals
- Prompt Engineering
- Building AI features in React

Enroll by this Friday to secure your spot!

Best Regards,
College Placement Cell`);
  };

  const handleBroadcast = () => {
    if (!subject || !message) {
      toast.error("Please provide both subject and message.");
      return;
    }

    setIsSending(true);
    // Simulate API call
    setTimeout(() => {
      toast.success(
        sendEmail 
          ? "Notification sent in-app and via email!" 
          : "In-app notification broadcasted successfully!"
      );
      setSubject("");
      setMessage("");
      setIsSending(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MegaphoneIcon className="h-7 w-7 text-blue-600" />
              Communications
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Announce and promote skill programs to your students
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-black text-slate-900 mb-6">Compose Announcement</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Target Audience</label>
                <div className="relative">
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full appearance-none pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  >
                    <option value="all">All Active Students</option>
                    <option value="csci">Computer Science Dept</option>
                    <option value="low-employability">Students with Low Employability Index</option>
                    <option value="unplaced">Unplaced Students (Final Year)</option>
                  </select>
                  <UsersIcon className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-bold text-slate-700">Subject</label>
                  <button 
                    onClick={loadTemplate}
                    className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    <SparklesIcon className="w-3 h-3" />
                    Use Template
                  </button>
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Action Required: Skill Assessment"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm transition-all focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Write your announcement here..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm transition-all focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm resize-y"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only" 
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                    />
                    <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-500 transition-colors"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors flex items-center gap-2">
                    <EnvelopeIcon className="w-5 h-5 text-slate-400" />
                    Also send via Email
                  </span>
                </label>

                <button
                  onClick={handleBroadcast}
                  disabled={isSending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                  ) : (
                    <PaperAirplaneIcon className="h-4 w-4" />
                  )}
                  {isSending ? "Broadcasting..." : "Broadcast Now"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* History / Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-6 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <CheckBadgeIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-black text-slate-900 mb-2">Pro-Tip</h3>
            <p className="text-sm font-medium text-slate-600">
              Students are <strong>3x more likely</strong> to enroll in a skill program if the announcement directly references their employability gap.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900">Recent Broadcasts</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              <li className="p-4 hover:bg-slate-50 transition-colors">
                <p className="text-sm font-bold text-slate-800 line-clamp-1">Mock Interview Drive Start</p>
                <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> 2 days ago</span>
                  <span className="flex items-center gap-1"><UsersIcon className="w-3.5 h-3.5" /> Final Year</span>
                </div>
              </li>
              <li className="p-4 hover:bg-slate-50 transition-colors">
                <p className="text-sm font-bold text-slate-800 line-clamp-1">Soft Skills Workshop Reminder</p>
                <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> 1 week ago</span>
                  <span className="flex items-center gap-1"><UsersIcon className="w-3.5 h-3.5" /> All Students</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
