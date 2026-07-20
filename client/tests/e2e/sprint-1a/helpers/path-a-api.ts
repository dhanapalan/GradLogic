/**
 * Path A API helpers — Question Bank → collections → drive → assign → ready/publish.
 * Used by flow-15 to seed reliable state; UI specs still verify each role surface.
 */
import type { APIRequestContext } from "@playwright/test";
import { API_URL, SUPER_ADMIN } from "../config/env";

export type PathABundle = {
  token: string;
  collectionId: string;
  collectionName: string;
  ruleId: string;
  ruleName: string;
  campusId: string;
  campusName: string;
  driveId?: string;
  driveName?: string;
};

async function login(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(`Login failed for ${email}: ${res.status()} ${JSON.stringify(body)}`);
  }
  const token = body?.data?.accessToken || body?.data?.token || body?.token || body?.accessToken;
  if (!token) throw new Error(`No token in login response for ${email}`);
  return token as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function pathALoginSuperAdmin(request: APIRequestContext): Promise<string> {
  return login(request, SUPER_ADMIN.email, SUPER_ADMIN.password);
}

/** Ensure Aptitude (or Python fallback) collection has bank questions. */
export async function ensurePathACollection(
  request: APIRequestContext,
  token: string
): Promise<{ collectionId: string; collectionName: string }> {
  const list = await request.get(`${API_URL}/question-collections`, {
    headers: auth(token),
  });
  const collections = ((await list.json())?.data || []) as Array<{
    id: string;
    name: string;
    category?: string;
    question_count?: number;
  }>;

  const prefer = ["aptitude", "reasoning", "python_coding"];
  let target =
    collections.find((c) => c.category === "aptitude") ||
    collections.find((c) => prefer.includes(String(c.category))) ||
    collections[0];

  if (!target) {
    const created = await request.post(`${API_URL}/question-collections`, {
      headers: auth(token),
      data: {
        name: `S1A PathA Aptitude ${Date.now().toString().slice(-6)}`,
        category: "aptitude",
        description: "Sprint 1A Path A validation collection",
      },
    });
    const body = await created.json();
    if (!created.ok()) {
      throw new Error(`Create collection failed: ${created.status()} ${JSON.stringify(body)}`);
    }
    target = { id: body.data.id, name: body.data.name, category: "aptitude", question_count: 0 };
  }

  if (!target.question_count || target.question_count < 1) {
    const fill = await request.post(
      `${API_URL}/question-collections/${target.id}/fill-from-bank`,
      { headers: auth(token), data: { limit: 15 } }
    );
    const fillBody = await fill.json().catch(() => ({}));
    if (!fill.ok()) {
      // Fall back to Python collection if aptitude bank fill fails
      const py = collections.find(
        (c) => c.category === "python_coding" && (c.question_count || 0) > 0
      );
      if (py) {
        return { collectionId: py.id, collectionName: py.name };
      }
      throw new Error(`fill-from-bank failed: ${fill.status()} ${JSON.stringify(fillBody)}`);
    }
  }

  return { collectionId: target.id, collectionName: target.name };
}

export async function pickAssessmentRule(
  request: APIRequestContext,
  token: string
): Promise<{ ruleId: string; ruleName: string }> {
  const res = await request.get(`${API_URL}/assessment-rules`, { headers: auth(token) });
  const rows = ((await res.json())?.data || []) as Array<{
    id: string;
    name: string;
    status?: string;
  }>;
  const preferred =
    rows.find((r) => /Aptitude.*Placement/i.test(r.name)) ||
    rows.find((r) => /published|active/i.test(String(r.status || "published"))) ||
    rows[0];
  if (!preferred) throw new Error("No assessment rules found — seed Placement Prep rules first");
  return { ruleId: preferred.id, ruleName: preferred.name };
}

export async function pickDemoCampus(
  request: APIRequestContext,
  token: string
): Promise<{ campusId: string; campusName: string }> {
  const res = await request.get(`${API_URL}/campuses`, { headers: auth(token) });
  const rows = ((await res.json())?.data || []) as Array<{ id: string; name: string }>;
  const demo =
    rows.find((c) => /Demo College/i.test(c.name)) ||
    rows.find((c) => c.id === "eaef6179-285f-48a8-83a5-419d285feea7") ||
    rows[0];
  if (!demo) throw new Error("No campuses found");
  return { campusId: demo.id, campusName: demo.name };
}

export async function bootstrapPathAContext(
  request: APIRequestContext
): Promise<PathABundle> {
  const token = await pathALoginSuperAdmin(request);
  const collection = await ensurePathACollection(request, token);
  const rule = await pickAssessmentRule(request, token);
  const campus = await pickDemoCampus(request, token);
  return { token, ...collection, ...rule, ...campus };
}

export async function createDriveFromCollection(
  request: APIRequestContext,
  bundle: PathABundle,
  driveName: string,
  driveType: "practice_test" | "mock_test" | "hiring" = "practice_test"
): Promise<{ driveId: string; driveName: string }> {
  const res = await request.post(`${API_URL}/drives`, {
    headers: auth(bundle.token),
    data: {
      name: driveName,
      rule_id: bundle.ruleId,
      drive_type: driveType,
      duration_minutes: 30,
      attempt_limit: driveType === "practice_test" ? 99 : 1,
      proctoring_mode: driveType === "practice_test" ? "none" : "standard",
      shuffle_questions: true,
      auto_submit: true,
      max_applicants: 500,
      collection_ids: [bundle.collectionId],
      sections: [{ collection_id: bundle.collectionId, section_name: bundle.collectionName }],
      auto_generate_pool: false,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(`Create drive failed: ${res.status()} ${JSON.stringify(body)}`);
  }
  const driveId = body?.data?.id as string;
  if (!driveId) throw new Error(`Create drive missing id: ${JSON.stringify(body)}`);
  return { driveId, driveName };
}

export async function approvePool(
  request: APIRequestContext,
  token: string,
  driveId: string
): Promise<void> {
  // Seed may already have run on create; reseed is safe if pool empty
  await request.post(`${API_URL}/drives/${driveId}/seed-from-collections`, {
    headers: auth(token),
  });
  const res = await request.post(`${API_URL}/drives/${driveId}/pool/approve`, {
    headers: auth(token),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`Pool approve failed: ${res.status()} ${JSON.stringify(body)}`);
  }
}

export async function assignCampus(
  request: APIRequestContext,
  token: string,
  driveId: string,
  campusId: string
): Promise<void> {
  const res = await request.post(`${API_URL}/drives/${driveId}/assignments`, {
    headers: auth(token),
    data: { college_id: campusId, segment: "" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`Assign campus failed: ${res.status()} ${JSON.stringify(body)}`);
  }
}

export async function markReadyAndPublish(
  request: APIRequestContext,
  token: string,
  driveId: string
): Promise<void> {
  const ready = await request.post(`${API_URL}/drives/${driveId}/ready`, {
    headers: auth(token),
  });
  const readyBody = await ready.json().catch(() => ({}));
  if (!ready.ok() && ready.status() !== 409) {
    throw new Error(`Mark ready failed: ${ready.status()} ${JSON.stringify(readyBody)}`);
  }

  const pub = await request.post(`${API_URL}/drives/${driveId}/publish`, {
    headers: auth(token),
  });
  const pubBody = await pub.json().catch(() => ({}));
  if (!pub.ok() && pub.status() !== 409) {
    throw new Error(`Publish failed: ${pub.status()} ${JSON.stringify(pubBody)}`);
  }
}

/** Full API Path A pipeline through publish (for UI role verification afterward). */
export async function runPathAPublishPipeline(
  request: APIRequestContext,
  driveName: string
): Promise<PathABundle> {
  const bundle = await bootstrapPathAContext(request);
  const drive = await createDriveFromCollection(request, bundle, driveName);
  await approvePool(request, bundle.token, drive.driveId);
  await assignCampus(request, bundle.token, drive.driveId, bundle.campusId);
  await markReadyAndPublish(request, bundle.token, drive.driveId);
  return { ...bundle, ...drive };
}
