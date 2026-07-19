export type CollegePayload = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  tpoName: string;
  tpoEmail: string;
  studentLimit: number;
};

export type StudentPayload = {
  roll_number: string;
  name: string;
  email: string;
  mobile?: string;
  department: string;
  batch: string;
  gender?: string;
};

function stamp(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export function buildCollege(overrides: Partial<CollegePayload> = {}): CollegePayload {
  const id = stamp();
  return {
    name: `QA College ${id}`,
    email: `qa.college.${id}@example.edu`,
    phone: `+9198${String(id).slice(-8).padStart(8, "0")}`,
    address: "100 QA Automation Street",
    city: "Bangalore",
    state: "Karnataka",
    tpoName: `TPO ${id}`,
    tpoEmail: `tpo.${id}@example.edu`,
    studentLimit: 100,
    ...overrides,
  };
}

export function buildStudent(overrides: Partial<StudentPayload> = {}): StudentPayload {
  const id = stamp();
  return {
    roll_number: `QA${id.slice(-8)}`,
    name: `QA Student ${id.slice(-6)}`,
    email: `qa.student.${id}@example.edu`,
    mobile: `98${String(id).slice(-8).padStart(8, "0")}`,
    department: "CSE",
    batch: "2026",
    gender: "male",
    ...overrides,
  };
}
