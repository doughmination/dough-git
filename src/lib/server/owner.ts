/* src/lib/server/owner.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { canRead } from "./access.ts";
import { findUserBySlug } from "./users.ts";
import { renderMarkdown, plainSummary } from "./markdown.ts";
import {
  PROFILE_REPO,
  headReadme,
  isProfileRepo,
  isRepoPublic,
  listRepos,
  repoExists,
  safeRef,
  type RepoSummary,
} from "./git.ts";
import { notFound } from "./web.ts";

function readable(all: RepoSummary[], viewer: string | null): RepoSummary[] {
  return all.filter((r) =>
    canRead({
      ref: {
        owner: r.owner,
        name: r.name,
      },
      isPublic: r.isPublic,
      viewer,
    }),
  );
}

async function profileReadme(owner: string, viewer: string | null) {
  const ref = safeRef(owner, PROFILE_REPO);
  if (!ref || !(await repoExists(ref))) return null;

  const isPublic = await isRepoPublic(ref);
  if (!canRead({ ref, isPublic, viewer })) return null;
  return headReadme(ref);
}

/** Everything the profile and repository-list pages show about an owner */
export async function ownerPage(owner: string, viewer: string | null, withReadme: boolean) {
  if (!safeRef(owner, "x")) notFound();

  const all = await listRepos();
  const owned = all.filter((r) => r.owner === owner);
  const profile = findUserBySlug(owner);
  if (!profile && owned.length === 0) notFound();

  const repos = readable(
    owned.filter((r) => !isProfileRepo(r.name)),
    viewer,
  );
  const readme = withReadme ? await profileReadme(owner, viewer) : null;

  return {
    owner,
    profile: profile
      ? {
          slug: profile.slug,
          name: profile.name,
          username: profile.username,
          picture: profile.picture,
          createdAt: profile.created_at,
        }
      : null,
    repos,
    readme: readme
      ? {
          path: readme.path,
          html: renderMarkdown(readme.text),
          summary: plainSummary(readme.text),
        }
      : null,
    hasProfileRepo: owned.some((r) => isProfileRepo(r.name)),
    isOwn: viewer === owner,
    profileRepo: PROFILE_REPO,
  };
}
