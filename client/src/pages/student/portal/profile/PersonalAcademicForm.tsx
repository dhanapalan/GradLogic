type Props = {
  mode: "overview" | "personal" | "academic" | "social";
  form: Record<string, unknown>;
  patch: (key: string, value: unknown) => void;
  editable: (key: string) => boolean;
};

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  readOnly,
  required,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        readOnly={readOnly}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          readOnly ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200 bg-white text-slate-900"
        }`}
        aria-readonly={readOnly || undefined}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function PersonalAcademicForm({ mode, form, patch, editable }: Props) {
  const v = (k: string) => (form[k] != null ? String(form[k]) : "");

  if (mode === "personal" || mode === "overview") {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="Personal information">
        <h2 className="text-sm font-black text-slate-900">Personal information</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name" name="first_name" value={v("first_name")} required onChange={(x) => patch("first_name", x)} readOnly={!editable("first_name")} />
          <Field label="Last name" name="last_name" value={v("last_name")} required onChange={(x) => patch("last_name", x)} readOnly={!editable("last_name")} />
          <Field label="Preferred name" name="preferred_name" value={v("preferred_name")} onChange={(x) => patch("preferred_name", x)} readOnly={!editable("preferred_name")} />
          <div>
            <label htmlFor="gender" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Gender</label>
            <select
              id="gender"
              value={v("gender")}
              disabled={!editable("gender")}
              onChange={(e) => patch("gender", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <Field label="Date of birth" name="dob" type="date" value={v("dob")?.slice(0, 10)} onChange={(x) => patch("dob", x)} readOnly={!editable("dob")} />
          <Field label="Blood group" name="blood_group" value={v("blood_group")} onChange={(x) => patch("blood_group", x)} readOnly={!editable("blood_group")} />
          <Field label="Mobile number" name="phone_number" value={v("phone_number")} required onChange={(x) => patch("phone_number", x)} readOnly={!editable("phone_number")} />
          <Field label="Alternate mobile" name="alternate_phone" value={v("alternate_phone")} onChange={(x) => patch("alternate_phone", x)} readOnly={!editable("alternate_phone")} />
          <Field label="Personal email" name="alternate_email" type="email" value={v("alternate_email")} onChange={(x) => patch("alternate_email", x)} readOnly={!editable("alternate_email")} />
          <Field label="Institutional email" name="email" type="email" value={v("institutional_email") || v("email")} readOnly hint="Managed by your institution" />
          <Field label="Nationality" name="nationality" value={v("nationality")} onChange={(x) => patch("nationality", x)} readOnly={!editable("nationality")} />
          <Field label="Category" name="category" value={v("category")} readOnly hint="Managed by college when set" />
        </div>

        <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-slate-400">Address</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Address line 1" name="address_line1" value={v("address_line1")} onChange={(x) => patch("address_line1", x)} />
          <Field label="Address line 2" name="address_line2" value={v("address_line2")} onChange={(x) => patch("address_line2", x)} />
          <Field label="City" name="city" value={v("city")} onChange={(x) => patch("city", x)} />
          <Field label="District" name="district" value={v("district")} onChange={(x) => patch("district", x)} />
          <Field label="State" name="state" value={v("state")} onChange={(x) => patch("state", x)} />
          <Field label="Country" name="country" value={v("country")} onChange={(x) => patch("country", x)} />
          <Field label="Postal code" name="postal_code" value={v("postal_code")} onChange={(x) => patch("postal_code", x)} />
        </div>

        <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-slate-400">Emergency contact</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Contact name" name="emergency_name" value={v("emergency_name")} onChange={(x) => patch("emergency_name", x)} />
          <Field label="Relationship" name="emergency_relationship" value={v("emergency_relationship")} onChange={(x) => patch("emergency_relationship", x)} />
          <Field label="Mobile number" name="emergency_phone" value={v("emergency_phone")} onChange={(x) => patch("emergency_phone", x)} />
        </div>
      </section>
    );
  }

  if (mode === "academic") {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="Academic information">
        <h2 className="text-sm font-black text-slate-900">Academic information</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Register number" name="register_number" value={v("register_number") || v("student_identifier")} readOnly />
          <Field label="Roll number" name="roll_number" value={v("roll_number")} onChange={(x) => patch("roll_number", x)} readOnly={!editable("roll_number")} />
          <Field label="Department" name="specialization" value={v("specialization")} onChange={(x) => patch("specialization", x)} readOnly={!editable("specialization")} />
          <Field label="Program" name="degree" value={v("degree")} onChange={(x) => patch("degree", x)} readOnly={!editable("degree")} />
          <Field label="Semester / Class" name="class_name" value={v("class_name")} onChange={(x) => patch("class_name", x)} readOnly={!editable("class_name")} />
          <Field label="Section" name="section" value={v("section")} onChange={(x) => patch("section", x)} readOnly={!editable("section")} />
          <Field label="Batch (passing year)" name="passing_year" type="number" value={v("passing_year")} onChange={(x) => patch("passing_year", x ? Number(x) : null)} readOnly={!editable("passing_year")} />
          <Field label="Admission year" name="admission_year" type="number" value={v("admission_year")} onChange={(x) => patch("admission_year", x ? Number(x) : null)} />
          <Field label="CGPA" name="cgpa" type="number" value={v("cgpa")} onChange={(x) => patch("cgpa", x ? Number(x) : null)} readOnly={!editable("cgpa")} />
          <Field label="Percentage" name="percentage" type="number" value={v("percentage")} onChange={(x) => patch("percentage", x ? Number(x) : null)} readOnly={!editable("percentage")} />
          <Field label="Current backlogs" name="current_backlogs" type="number" value={v("current_backlogs")} onChange={(x) => patch("current_backlogs", x ? Number(x) : null)} />
          <Field label="Academic advisor" name="academic_advisor" value={v("academic_advisor")} onChange={(x) => patch("academic_advisor", x)} />
          <Field label="Academic status" name="academic_status" value={v("academic_status")} onChange={(x) => patch("academic_status", x)} />
          <Field label="College" name="college_name" value={v("college_name")} readOnly />
        </div>
      </section>
    );
  }

  // social
  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="Social profiles">
      <h2 className="text-sm font-black text-slate-900">Social profiles</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="LinkedIn" name="linkedin_url" value={v("linkedin_url")} onChange={(x) => patch("linkedin_url", x)} />
        <Field label="GitHub" name="github_url" value={v("github_url")} onChange={(x) => patch("github_url", x)} />
        <Field label="Portfolio website" name="portfolio_url" value={v("portfolio_url")} onChange={(x) => patch("portfolio_url", x)} />
        <Field label="Kaggle" name="kaggle_url" value={v("kaggle_url")} onChange={(x) => patch("kaggle_url", x)} />
        <Field label="HackerRank" name="hackerrank_url" value={v("hackerrank_url")} onChange={(x) => patch("hackerrank_url", x)} />
        <Field label="LeetCode" name="leetcode_url" value={v("leetcode_url")} onChange={(x) => patch("leetcode_url", x)} />
        <Field label="CodeChef" name="codechef_url" value={v("codechef_url")} onChange={(x) => patch("codechef_url", x)} />
        <Field label="Other professional links" name="other_links" value={v("other_links")} onChange={(x) => patch("other_links", x)} />
      </div>
    </section>
  );
}
