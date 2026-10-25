import fn from "../../supabase/functions/delete-account/index.ts";

const USER = "98000000-0000-0000-0000-000000000005";

function assert(value: unknown, message: string) {
  if (!value) throw Error(message);
}

function mock(pending = false, storageFails = false) {
  const calls: string[] = [];

  const ctx = {
    userClaims: { id: USER },
    supabase: {
      auth: {
        getUser: async () => ({
          data: { user: { id: USER } },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                revision: 0,
                deletion_requested_at: pending ? "2026-10-25" : null,
              },
              error: null,
            }),
          }),
        }),
      }),
      rpc: async () => {
        calls.push("freeze");
        return { error: null };
      },
    },
    supabaseAdmin: {
      storage: {
        from: () => ({
          list: async () => {
            calls.push("storage");
            return {
              data: storageFails ? null : [],
              error: storageFails ? { message: "test failure" } : null,
            };
          },
        }),
      },
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            calls.push(`delete:${id}`);
            return { error: null };
          },
        },
      },
    },
  };

  return { ctx, calls };
}

async function request(ctx: ReturnType<typeof mock>["ctx"]) {
  return await fn.fetch(
    new Request("https://test.invalid/", {
      method: "POST",
      headers: { Authorization: "Bearer fake-test-token" },
      body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
    }),
    ctx,
  );
}

Deno.test("Deletion safety with mocked Supabase", async () => {
  try {
    Deno.env.delete("ACCOUNT_DELETION_ENABLED");
    Deno.env.delete("ACCOUNT_DELETION_TEST_USER_ID");

    const disabled = mock();
    assert((await request(disabled.ctx)).status === 503, "Deletion must default to disabled");
    assert(disabled.calls.length === 0, "Disabled deletion touched data");

    Deno.env.set("ACCOUNT_DELETION_ENABLED", "true");

    const restricted = mock();
    assert((await request(restricted.ctx)).status === 403, "Test account guard missing");
    assert(restricted.calls.length === 0, "Wrong account touched data");

    Deno.env.set("ACCOUNT_DELETION_TEST_USER_ID", USER);

    const normal = mock();
    assert((await request(normal.ctx)).status === 200, "Mock deletion failed");
    assert(
      normal.calls.join(",") === `freeze,storage,delete:${USER}`,
      "Unsafe deletion order",
    );

    const failure = mock(false, true);
    assert((await request(failure.ctx)).status === 503, "Storage error not handled");
    assert(!failure.calls.some(x => x.startsWith("delete:")), "Deleted after Storage error");

    const retry = mock(true);
    assert((await request(retry.ctx)).status === 200, "Pending deletion cannot resume");
    assert(!retry.calls.includes("freeze"), "Pending deletion was frozen twice");
  } finally {
    Deno.env.delete("ACCOUNT_DELETION_ENABLED");
    Deno.env.delete("ACCOUNT_DELETION_TEST_USER_ID");
  }
});

Deno.test("Unauthorized and invalid requests are rejected", async () => {
  const instance = mock();

  const wrongUser = {
    ...instance.ctx,
    userClaims: {
      id: "98000000-0000-0000-0000-000000000006",
    },
  };

  const wrongIdentity = await request(wrongUser);
  assert(wrongIdentity.status === 401, "Other identity must be rejected");

  const missingToken = await fn.fetch(
    new Request("https://test.invalid/", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
    }),
    instance.ctx,
  );
  assert(missingToken.status === 401, "Missing token must be rejected");

  const invalidConfirmation = await fn.fetch(
    new Request("https://test.invalid/", {
      method: "POST",
      headers: { Authorization: "Bearer fake-test-token" },
      body: JSON.stringify({ confirmation: "YES" }),
    }),
    instance.ctx,
  );
  assert(invalidConfirmation.status === 400, "Invalid confirmation must be rejected");

  assert(instance.calls.length === 0, "Rejected requests must not change data");
});
