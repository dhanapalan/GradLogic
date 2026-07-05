import { useState } from "react";
import { 
  ArrowDownTrayIcon, 
  FunnelIcon,
  DocumentChartBarIcon, 
  MagnifyingGlassIcon,
  ChevronDownIcon
} from "@heroicons/react/24/outline";

// Dummy Data
const MOCK_RESULTS = [
  { id: "1", name: "Rahul Sharma", email: "rahul.s@college.edu", dept: "Computer Science", program: "TCS Ninja Mock", score: 85, rank: 12, status: "Pass" },
  { id: "2", name: "Anjali Gupta", email: "anjali.g@college.edu", dept: "Information Tech", program: "Cognizant GenC", score: 92, rank: 3, status: "Pass" },
  { id: "3", name: "Vikram Singh", email: "vikram.s@college.edu", dept: "Electronics", program: "Infosys System Engineer", score: 45, rank: 115, status: "Fail" },
  { id: "4", name: "Priya Patel", email: "priya.p@college.edu", dept: "Mechanical", program: "Core Engineering Aptitude", score: 78, rank: 45, status: "Pass" },
  { id: "5", name: "Rohan Desai", email: "rohan.d@college.edu", dept: "Computer Science", program: "TCS Ninja Mock", score: 58, rank: 89, status: "Fail" },
  { id: "6", name: "Sneha Reddy", email: "sneha.r@college.edu", dept: "Information Tech", program: "Cognizant GenC", score: 88, rank: 18, status: "Pass" }
];

export default function CollegeResultsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [department, setDepartment] = useState("all");
  
  const filteredResults = MOCK_RESULTS.filter(res => {
    const matchesSearch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) || res.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = department === "all" || res.dept === department;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <DocumentChartBarIcon className="h-7 w-7 text-indigo-600" />
              Results & Reports
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">Review student performance across all assessments</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm transition-colors">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative w-full md:w-96">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by student name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <select 
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="appearance-none pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                <option value="all">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Tech">Information Tech</option>
                <option value="Electronics">Electronics</option>
                <option value="Mechanical">Mechanical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-1">Student <ChevronDownIcon className="w-3 h-3" /></div>
                  </th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Assessment</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-1">Score <ChevronDownIcon className="w-3 h-3" /></div>
                  </th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredResults.length > 0 ? (
                  filteredResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{row.name}</div>
                        <div className="text-slate-500 text-xs font-medium">{row.email}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600">{row.dept}</td>
                      <td className="px-6 py-4 text-slate-700">{row.program}</td>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-900">{row.score}%</div>
                        <div className="text-xs text-slate-400 font-semibold">Rank #{row.rank}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                          row.status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <DocumentChartBarIcon className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="font-bold text-slate-600">No results found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Showing {filteredResults.length} records</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50" disabled>Previous</button>
              <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50" disabled>Next</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
