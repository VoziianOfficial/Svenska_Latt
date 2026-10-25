import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const fail = (code: string, status: number) =>
  Response.json({ error: code }, { status });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return fail("method_not_allowed", 405);
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      return fail("authentication_required", 401);
    }

    // The account ID always comes from the authenticated JWT.
    // Never accept a target user ID supplied by the browser.
    const bearer = req.headers.get("Authorization") ?? "";
    const accessToken = /^Bearer\s+(\S+)$/i.exec(bearer)?.[1];

    if (!accessToken) {
      return fail("authentication_required", 401);
    }

    const { data: identity, error: identityError } = await ctx.supabase.auth
      .getUser(accessToken);

    if (identityError || identity.user?.id !== userId) {
      return fail("identity_verification_failed", 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("invalid_request", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      (body as Record<string, unknown>).confirmation !==
        "DELETE MY ACCOUNT"
    ) {
      return fail("confirmation_required", 400);
    }

    // Require the account password immediately before deletion.
    const password = (body as Record<string, unknown>).password;

    if (
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 1024
    ) {
      return fail("password_required", 400);
    }

    const email = identity.user?.email;
    if (!email) {
      return fail("account_email_required", 409);
    }

    const { data: verified, error: passwordError } = await ctx.supabase.auth
      .signInWithPassword({
        email,
        password,
      });

    if (passwordError || verified.user?.id !== userId) {
      return fail("password_verification_failed", 401);
    }

    // Never enable real deletion before completing safety tests.
    if (Deno.env.get("ACCOUNT_DELETION_ENABLED") !== "true") {
      return fail("deletion_not_enabled", 503);
    }

    // During testing, only one explicitly allowed account may be deleted.
    const testUserId = Deno.env.get("ACCOUNT_DELETION_TEST_USER_ID");

    if (testUserId && testUserId !== userId) {
      return fail("deletion_test_account_only", 403);
    }

    // Read only the authenticated user's account.
    const { data: account, error: accountError } = await ctx.supabase
      .from("sl_accounts")
      .select("revision,deletion_requested_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (accountError) return fail("account_lookup_failed", 503);
    if (!account) return fail("account_not_initialized", 409);

    // Freeze writes once. An interrupted deletion can resume.
    if (!account.deletion_requested_at) {
      const { error: requestError } = await ctx.supabase.rpc(
        "sl_request_account_deletion",
        { p_expected_revision: account.revision },
      );

      if (requestError) {
        return fail("deletion_request_failed_retry", 409);
      }
    }

    // Delete avatar files through Storage API, not SQL metadata.
    const storage = ctx.supabaseAdmin.storage.from("avatars");
    const folders = [userId];
    let processed = 0;

    while (folders.length) {
      const folder = folders.pop()!;

      while (true) {
        const { data: entries, error: listError } = await storage.list(folder, {
          limit: 100,
          offset: 0,
        });

        if (listError) return fail("storage_cleanup_failed_retry", 503);
        if (!entries?.length) break;

        const paths: string[] = [];

        for (const item of entries) {
          const path = `${folder}/${item.name}`;

          if (item.id === null) {
            folders.push(path);
          } else {
            paths.push(path);
          }
        }

        if (paths.length) {
          const { error: removeError } = await storage.remove(paths);
          if (removeError) {
            return fail("storage_cleanup_failed_retry", 503);
          }
        }

        processed += entries.length;
        if (processed > 5000) {
          return fail("storage_cleanup_limit_retry", 503);
        }

        if (!paths.length) break;
      }
    }

    // Database tables referencing auth.users/sl_accounts use
    // ON DELETE CASCADE. Do not delete those tables manually.
    const { error: deleteError } = await ctx.supabaseAdmin.auth.admin
      .deleteUser(userId);

    if (deleteError) {
      return fail("account_deletion_failed_retry", 503);
    }

    return Response.json({ status: "deleted" });
  }),
};
