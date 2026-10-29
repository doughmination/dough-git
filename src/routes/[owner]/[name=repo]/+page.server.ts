/* src/routes/[owner]/[name=repo]/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { config } from "#lib/server/config.ts";
import { sessionSlug } from "#lib/server/auth.ts";
import { findUserBySlug } from "#lib/server/users.ts";
import { getSettings } from "#lib/server/settings.ts";
import { clearRepoMetadata } from "#lib/server/repometa.ts";
import { notifyRepoDeleted } from "#lib/server/notify.ts";
import { renderMarkdown, plainSummary } from "#lib/server/markdown.ts";
import { describeMirror } from "#lib/server/mirrorview.ts";
import {
  isLevel,
  listCollaborators,
  removeCollaborator,
  setCollaborator,
} from "#lib/server/access.ts";
import {
  MIRROR_KINDS,
  mirrorHost,
  mirrorSlug,
  mirrorUrl,
  type MirrorKind,
} from "#lib/server/urls.ts";
import {
  checkAllMirrors,
  dropMirrorStatusKind,
  getStatuses,
  needsCheck,
} from "#lib/server/mirror.ts";
import {
  description,
  isRepoPublic,
  localMirrorRefs,
  log,
  readLinks,
  readme,
  refSlug,
  setDescription,
  setLinks,
  setRepoPublic,
  trashRepo,
  type MirrorLink,
  type RepoRef,
} from "#lib/server/git.ts";
import {
  fail,
  field,
  me,
  ownedRef,
  revQuery,
  viewable,
  writableRef,
} from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const { ref, isPublic, access, refs, rev } = await viewable(event);

  const [commits, rawDescription, links] = await Promise.all([
    log(ref, rev, 1),
    description(ref),
    readLinks(ref),
  ]);
  const readmeFile = commits.length ? await readme(ref, rev) : null;

  const user = event.locals.user;
  const viewer = user ? sessionSlug(user) : null;
  const isOwner = viewer === ref.owner;
  const canPush = access === "write";

  const statuses = getStatuses(ref);
  let localSha: string | null = null;
  if (links.length > 0) {
    const localRefs = await localMirrorRefs(ref);
    localSha = localRefs.get(`refs/heads/${refs.head}`) ?? null;

    if (canPush && getSettings(ref.owner).mirrorAuto) {
      const due = links.filter((l) => !l.isPrivate && needsCheck(statuses.get(l.kind)));
      if (due.length > 0) {
        void checkAllMirrors(ref, due).catch((err) => {
          console.warn(`[mirror] background check failed for ${refSlug(ref)}:`, err);
        });
      }
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const summary = readmeFile ? plainSummary(readmeFile.text) : "";

  return {
    owner: ref.owner,
    name: ref.name,
    isPublic,
    empty: refs.branches.length === 0,
    refs,
    rev,
    query: revQuery(rev, refs.head),
    cloneUrl: `${config.baseUrl}/${ref.owner}/${ref.name}.git`,
    pusher: viewer ?? ref.owner,
    rawDescription,
    metaDescription:
      rawDescription.trim() || summary || `${ref.owner}/${ref.name} — a git repository on ${config.title}.`,
    readme: readmeFile
      ? {
          path: readmeFile.path,
          html: renderMarkdown(readmeFile.text),
        }
      : null,
    canPush,
    isOwner,
    collaborators: isOwner ? listCollaborators(ref) : null,
    mirrors: links.map((link) => describeMirror(link, statuses.get(link.kind) ?? null, nowSec)),
    canCheckMirrors: canPush && links.some((l) => !l.isPrivate),
    mirrorFields: MIRROR_KINDS.map((kind) => {
      const existing = links.find((l) => l.kind === kind);
      return {
        kind,
        value: existing ? mirrorSlug(kind, existing.url) : "",
        isPrivate: existing?.isPrivate ?? false,
      };
    }),
    mirrorHosts: MIRROR_KINDS.map(mirrorHost).join(" or "),
    localSha,
  };
};

function back(ref: RepoRef): never {
  redirect(303, `/${ref.owner}/${ref.name}`);
}

export const actions: Actions = {
  description: async (event) => {
    const ref = await writableRef(event);
    const form = await event.request.formData();
    await setDescription(ref, field(form, "description"));
    back(ref);
  },

  visibility: async (event) => {
    const ref = await ownedRef(event);
    const form = await event.request.formData();
    await setRepoPublic(ref, form.get("public") === "on");
    back(ref);
  },

  delete: async (event) => {
    const ref = await ownedRef(event);
    const slug = sessionSlug(me(event));
    const wasPublic = await isRepoPublic(ref);

    const result = await trashRepo(ref, {
      deletedAt: Math.floor(Date.now() / 1000),
      deletedBy: slug,
      grants: listCollaborators(ref).map((g) => ({
        slug: g.slug,
        level: g.level,
      })),
    });
    if (!result.ok) fail("could not delete", result.error ?? "unknown error");

    clearRepoMetadata(ref);
    notifyRepoDeleted(ref, slug, wasPublic);
    redirect(303, "/settings/deleted");
  },

  collaborator: async (event) => {
    const ref = await ownedRef(event);
    const form = await event.request.formData();
    const slug = field(form, "slug").trim().toLowerCase();
    const levelRaw = field(form, "level") || "read";
    const level = isLevel(levelRaw) ? levelRaw : "read";

    const invited = findUserBySlug(slug);
    if (!invited) {
      fail(
        "no such user",
        `Nobody on this instance goes by "${slug}". They have to sign in ` +
          `to this instance once before they can be added.`,
      );
    }
    if (invited.slug === ref.owner) {
      fail("already the owner", "You can't add yourself as a collaborator on your own repo.");
    }

    setCollaborator(ref, invited.slug, level);
    back(ref);
  },

  uncollaborate: async (event) => {
    const ref = await ownedRef(event);
    const form = await event.request.formData();
    removeCollaborator(ref, field(form, "slug"));
    back(ref);
  },

  mirrors: async (event) => {
    const ref = await ownedRef(event);
    const form = await event.request.formData();

    const links: MirrorLink[] = [];
    const rejected: MirrorKind[] = [];
    for (const kind of MIRROR_KINDS) {
      const raw = field(form, kind).trim();
      if (!raw) continue;
      const url = mirrorUrl(kind, raw);
      if (!url) {
        rejected.push(kind);
        continue;
      }
      links.push({
        kind,
        url,
        isPrivate: form.get(`${kind}_private`) != null,
      });
    }

    if (rejected.length > 0) {
      fail(
        "that isn't a mirror URL",
        `The ${rejected.join(" and ")} link was refused. Give the repository as ` +
          `owner/repo — for example doughmination/dough-git — and it is looked up on ` +
          `${mirrorHost(rejected[0]!)}.`,
      );
    }

    const before = await readLinks(ref);
    await setLinks(ref, links);
    for (const old of before) {
      const still = links.find((l) => l.kind === old.kind && l.url === old.url);
      if (!still) dropMirrorStatusKind(ref, old.kind);
    }
    back(ref);
  },

  check: async (event) => {
    const ref = await writableRef(event);
    await checkAllMirrors(ref, await readLinks(ref));
    back(ref);
  },
};
