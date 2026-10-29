/* src/routes/settings/deleted/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { config } from "#lib/server/config.ts";
import { sessionSlug } from "#lib/server/auth.ts";
import { isLevel, setCollaborator } from "#lib/server/access.ts";
import { findUserBySlug } from "#lib/server/users.ts";
import { clearRepoMetadata } from "#lib/server/repometa.ts";
import {
  listTrash,
  purgeExpired,
  purgeFromTrash,
  refSlug,
  restoreFromTrash,
} from "#lib/server/git.ts";
import { fail, field, me } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const owner = sessionSlug(me(event));

  for (const gone of await purgeExpired(owner)) {
    clearRepoMetadata({
      owner,
      name: gone.name,
    });
    console.log(`[trash] purged ${owner}/${gone.name} past retention`);
  }

  return {
    entries: await listTrash(owner),
    retentionDays: config.trashDays,
  };
};

export const actions: Actions = {
  restore: async (event) => {
    const owner = sessionSlug(me(event));
    const form = await event.request.formData();

    const result = await restoreFromTrash(owner, field(form, "entry"));
    if (!result.ok || !result.meta) fail("could not restore", result.error ?? "unknown error");

    const ref = {
      owner,
      name: result.meta.name,
    };
    for (const grant of result.meta.grants) {
      if (!isLevel(grant.level)) continue;
      if (!findUserBySlug(grant.slug)) {
        console.warn(`[trash] restoring ${refSlug(ref)}: dropping grant for unknown user ${grant.slug}`);
        continue;
      }
      setCollaborator(ref, grant.slug, grant.level);
    }

    console.log(`[trash] restored ${refSlug(ref)}`);
    redirect(303, `/${ref.owner}/${ref.name}`);
  },

  purge: async (event) => {
    const owner = sessionSlug(me(event));
    const form = await event.request.formData();
    const entry = field(form, "entry");

    const found = (await listTrash(owner)).find((e) => e.entry === entry);
    if (await purgeFromTrash(owner, entry)) {
      if (found) {
        clearRepoMetadata({
          owner,
          name: found.name,
        });
      }
      console.log(`[trash] purged ${owner}/${found?.name ?? entry}`);
    }
    redirect(303, "/settings/deleted");
  },
};
