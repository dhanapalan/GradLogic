import { Link } from "react-router-dom";
import { Mic, Volume2 } from "lucide-react";

export default function AiVoiceToolPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link to="/app/superadmin/knowledge-library/ai" className="text-xs text-admin-accent hover:underline">
          ← AI Features
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Mic className="w-5 h-5" /> AI Voice
        </h2>
        <p className="text-sm text-gray-500">
          Voice is synthesized on demand from knowledge text (browser TTS + Voice Tutor). Configure voices here, then listen
          from Voice Lessons or the student tutor.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          to="/app/superadmin/voice-studio/tutor-voices"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card hover:border-gray-300"
        >
          <Volume2 className="w-4 h-4 text-navy-900 mb-2" />
          <h3 className="font-medium text-sm text-gray-900">AI Tutor Voices</h3>
          <p className="text-xs text-gray-500 mt-1">Select and preview tutor voices.</p>
        </Link>
        <Link
          to="/app/superadmin/knowledge-library/assets/voice-lessons"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card hover:border-gray-300"
        >
          <Mic className="w-4 h-4 text-navy-900 mb-2" />
          <h3 className="font-medium text-sm text-gray-900">Voice Lessons</h3>
          <p className="text-xs text-gray-500 mt-1">Published voice lesson assets in the library.</p>
        </Link>
        <Link
          to="/app/superadmin/learning-companion/studio?kind=voice_lessons"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card hover:border-gray-300"
        >
          <h3 className="font-medium text-sm text-gray-900">Generate voice lesson</h3>
          <p className="text-xs text-gray-500 mt-1">Content Studio voice generation.</p>
        </Link>
        <Link
          to="/app/superadmin/voice-studio/languages"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-admin-card hover:border-gray-300"
        >
          <h3 className="font-medium text-sm text-gray-900">Languages</h3>
          <p className="text-xs text-gray-500 mt-1">Multi-language voice tutor support.</p>
        </Link>
      </div>
    </div>
  );
}
