/**
 * Integration test for Admin Projects CRUD + media uploads (Task #47).
 *
 * Runs against the dev API server (default http://localhost:8080).
 * Uses node:test (built into Node 20+) so no extra runner needs to be installed.
 *
 *   pnpm --filter @workspace/api-server test
 *
 * Required env (defaults shown):
 *   API_URL          http://localhost:8080
 *   ADMIN_EMAIL      admin@uniquebuilders.in
 *   ADMIN_PASSWORD   admin123
 *
 * The test is read-mostly: the only mutation is a no-op visibility toggle
 * (off → on) on the first project, which leaves the database in the same
 * state it started in.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const API_URL = process.env.API_URL ?? "http://localhost:8080";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@uniquebuilders.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

async function login() {
  const res = await fetch(`${API_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  const body = await res.json();
  assert.ok(typeof body.token === "string" && body.token.length > 0, "token returned");
  return body.token;
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

test("admin can log in and list projects", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data), "projects.data is an array");
  assert.ok(body.data.length > 0, "at least one project returned");
});

test("project highlights are object-shaped (title/description/image)", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  });
  const body = await res.json();
  const withHighlights = body.data.find(
    (p) => Array.isArray(p.highlights) && p.highlights.length > 0,
  );
  assert.ok(withHighlights, "expected at least one project with highlights");
  for (const h of withHighlights.highlights) {
    assert.equal(typeof h, "object", "highlight is an object, not a string");
    assert.ok("title" in h, "highlight has title");
    assert.ok("description" in h, "highlight has description");
    assert.ok("image" in h, "highlight has image");
  }
});

test("public project endpoint returns object-shape highlights", async () => {
  const token = await login();
  const list = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  }).then((r) => r.json());
  const slug = list.data[0].slug;
  const res = await fetch(`${API_URL}/api/projects/${slug}`);
  assert.equal(res.status, 200, "public project endpoint returns 200");
  const body = await res.json();
  const project = body.data ?? body;
  assert.ok(Array.isArray(project.highlights), "highlights is an array");
  for (const h of project.highlights) {
    assert.equal(typeof h, "object");
    assert.ok("title" in h && "description" in h && "image" in h);
  }
});

test("PATCH /admin/projects/:id can toggle isActive", async () => {
  const token = await login();
  const list = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  }).then((r) => r.json());
  const target = list.data[0];
  const original = target.isActive;

  // toggle off
  let res = await fetch(`${API_URL}/api/admin/projects/${target.id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ isActive: !original }),
  });
  assert.equal(res.status, 200, "PATCH off succeeds");
  let body = await res.json();
  assert.equal(body.data.isActive, !original);

  // toggle back on (restore state)
  res = await fetch(`${API_URL}/api/admin/projects/${target.id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ isActive: original }),
  });
  assert.equal(res.status, 200, "PATCH restore succeeds");
  body = await res.json();
  assert.equal(body.data.isActive, original);
});

test("PATCH /admin/projects/:id can update sortOrder (reorder)", async () => {
  const token = await login();
  const list = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  }).then((r) => r.json());
  const target = list.data[0];
  const newOrder = (target.sortOrder ?? 0) + 1000;

  let res = await fetch(`${API_URL}/api/admin/projects/${target.id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ sortOrder: newOrder }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.sortOrder, newOrder);

  // restore original sortOrder
  res = await fetch(`${API_URL}/api/admin/projects/${target.id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ sortOrder: target.sortOrder ?? 0 }),
  });
  assert.equal(res.status, 200);
});

test("uploads /file-url accepts PDF documents", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/uploads/file-url`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ contentType: "application/pdf", size: 1024 * 1024 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.kind, "document");
  assert.ok(body.uploadURL.startsWith("https://"), "presigned upload URL returned");
  assert.ok(body.objectPath.startsWith("/objects/"));
});

test("uploads /file-url accepts MP4 video", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/uploads/file-url`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ contentType: "video/mp4", size: 5 * 1024 * 1024 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.kind, "video");
});

test("uploads /file-url accepts images", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/uploads/file-url`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ contentType: "image/png", size: 50000 }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).kind, "image");
});

test("uploads /file-url rejects executables", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/uploads/file-url`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ contentType: "application/x-msdownload", size: 100 }),
  });
  assert.equal(res.status, 400);
});

test("uploads /file-url rejects oversize PDF (> 25 MB)", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/uploads/file-url`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      contentType: "application/pdf",
      size: 30 * 1024 * 1024,
    }),
  });
  assert.equal(res.status, 400);
});

test("uploads /image-url (legacy) still rejects PDFs", async () => {
  const token = await login();
  const res = await fetch(`${API_URL}/api/admin/uploads/image-url`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ contentType: "application/pdf", size: 100 }),
  });
  assert.equal(res.status, 400, "legacy image endpoint must reject PDFs");
});

test("admin endpoints reject unauthenticated requests", async () => {
  const res = await fetch(`${API_URL}/api/admin/projects`);
  assert.ok(res.status === 401 || res.status === 403, "blocked without token");
});

test("admin happy-path: create → edit → delete project", async () => {
  const token = await login();
  const slug = `e2e-smoke-${Date.now()}`;
  const payload = {
    slug,
    name: "E2E Smoke Project",
    category: "RESIDENTIAL",
    status: "ongoing",
    address: "Test Address",
    city: "Hyderabad",
    description: "Smoke test description",
    isActive: true,
    sortOrder: 9999,
    highlights: [
      { title: "Pool", description: "Heated", image: "" },
      { title: "Gym", description: "24x7", image: "" },
    ],
    faqs: [{ question: "When?", answer: "Soon" }],
    amenities: ["Pool", "Gym"],
    galleryImages: [],
    floorPlans: [],
    similarProjects: [],
  };

  // CREATE
  let res = await fetch(`${API_URL}/api/admin/projects`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 201, `create returned ${res.status}`);
  const created = (await res.json()).data;
  assert.equal(created.slug, slug);
  assert.equal(created.highlights.length, 2);
  assert.equal(created.highlights[0].title, "Pool");

  try {
    // EDIT
    res = await fetch(`${API_URL}/api/admin/projects/${created.id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "E2E Smoke Project (edited)" }),
    });
    assert.equal(res.status, 200);
    const edited = (await res.json()).data;
    assert.equal(edited.name, "E2E Smoke Project (edited)");

    // VERIFY persistence via the list endpoint
    res = await fetch(`${API_URL}/api/admin/projects`, {
      headers: authHeaders(token),
    });
    assert.equal(res.status, 200);
    const found = (await res.json()).data.find((p) => p.id === created.id);
    assert.ok(found, "project still in list after edit");
    assert.equal(found.name, "E2E Smoke Project (edited)");
  } finally {
    // DELETE (cleanup runs even if assertions above fail)
    const del = await fetch(`${API_URL}/api/admin/projects/${created.id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    assert.ok(del.ok, `delete returned ${del.status}`);
  }

  // VERIFY gone — should no longer appear in admin list
  const listAfter = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  }).then((r) => r.json());
  const stillThere = listAfter.data.find((p) => p.id === created.id);
  assert.equal(stillThere, undefined, "deleted project no longer listed");
});

test("public project detail returns all the sections used by ProjectDetail3", async () => {
  // Pick a real seeded project and confirm the response shape that
  // the public detail page renders end-to-end (parity check).
  const token = await login();
  const list = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  }).then((r) => r.json());
  const slug = list.data[0].slug;

  const res = await fetch(`${API_URL}/api/projects/${slug}`);
  assert.equal(res.status, 200);
  const project = (await res.json()).data ?? (await res.json());

  for (const key of [
    "slug",
    "name",
    "category",
    "status",
    "highlights",
    "amenities",
    "galleryImages",
    "faqs",
  ]) {
    assert.ok(key in project, `public detail response missing "${key}"`);
  }
  assert.ok(Array.isArray(project.highlights));
  assert.ok(Array.isArray(project.amenities));
  assert.ok(Array.isArray(project.galleryImages));
  assert.ok(Array.isArray(project.faqs));
});

test("RESEED_CORE=1 re-syncs canonical fields without clobbering admin flags", async () => {
  const token = await login();
  const list = await fetch(`${API_URL}/api/admin/projects`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

  // The 4 core seeded projects all have these slugs.
  const CORE_SLUGS = [
    "city-unique-life",
    "is-paradise",
    "unique-green-meadows",
    "unique-new-town",
  ];
  const target = list.data.find((p) => CORE_SLUGS.includes(p.slug));
  assert.ok(target, "expected at least one of the 4 core projects in the DB");

  // Helper: read the admin-side detail for a slug (bypasses public visibility filters).
  const readAdmin = async () => {
    const r = await fetch(`${API_URL}/api/admin/projects`, {
      headers: authHeaders(token),
    }).then((r) => r.json());
    return r.data.find((p) => p.id === target.id);
  };

  // 1. Mutate canonical content + an admin-managed flag/order. Force isActive=false
  //    so we can later verify the seeder doesn't flip it back to canonical (true).
  const mutatedDescription = `__RESEED_TEST__ ${Date.now()}`;
  const newSortOrder = (target.sortOrder ?? 0) + 7777;
  let res = await fetch(`${API_URL}/api/admin/projects/${target.id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      aboutDescription: mutatedDescription,
      sortOrder: newSortOrder,
      isActive: false,
    }),
  });
  assert.equal(res.status, 200, "mutation PATCH succeeds");

  // 2. Run the seeder WITHOUT RESEED_CORE — mutated description must persist.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const apiServerDir = resolve(__dirname, "..");
  const runSeed = (reseedFlag) =>
    execFileSync("pnpm", ["run", "seed:cms"], {
      cwd: apiServerDir,
      env: { ...process.env, RESEED_CORE: reseedFlag },
      stdio: "ignore",
    });

  runSeed("");
  let snap = await readAdmin();
  assert.equal(
    snap.aboutDescription,
    mutatedDescription,
    "default seed run must NOT overwrite admin-edited content",
  );

  // 3. Run the seeder WITH RESEED_CORE=1 — canonical description restored,
  //    admin-managed flags (isActive / sortOrder) preserved.
  runSeed("1");
  snap = await readAdmin();
  assert.notEqual(
    snap.aboutDescription,
    mutatedDescription,
    "RESEED_CORE=1 must restore canonical description",
  );
  assert.equal(
    snap.sortOrder,
    newSortOrder,
    "RESEED_CORE must NOT overwrite admin sortOrder",
  );
  assert.equal(
    snap.isActive,
    false,
    "RESEED_CORE must NOT overwrite admin isActive",
  );

  // Restore original admin flags so subsequent runs are stable.
  await fetch(`${API_URL}/api/admin/projects/${target.id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      sortOrder: target.sortOrder ?? 0,
      isActive: target.isActive,
    }),
  });
});
