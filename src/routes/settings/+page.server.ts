/* src/routes/settings/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { accountUrl, sessionSlug } from "#lib/server/auth.ts";
import { AVATAR_MAX_BYTES, removeAvatar, saveAvatar } from "#lib/server/avatars.ts";
import { findUserBySlug } from "#lib/server/users.ts";
import { getSettings, setDiscordWebhook, setPrefs } from "#lib/server/settings.ts";
import { discordWebhookUrl, maskWebhook } from "#lib/server/urls.ts";
import { fail, field, me } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const slug = sessionSlug(me(event));
  const settings = await getSettings(slug);

  return {
    slug,
    // The webhook URL is a credential, so only its masked form reaches the page
    webhook: settings.discordWebhook ? maskWebhook(settings.discordWebhook) : null,
    webhookError: settings.discordWebhook ? settings.webhookError : null,
    webhookErrorAt: settings.webhookErrorAt,
    defaultPrivate: settings.defaultPrivate,
    discordPrivate: settings.discordPrivate,
    mirrorAuto: settings.mirrorAuto,
    hasUpload: Boolean((await findUserBySlug(slug))?.avatar_at),
    avatarMaxMb: AVATAR_MAX_BYTES / (1024 * 1024),
    accountUrl: accountUrl(),
    saved: event.url.searchParams.has("saved"),
  };
};

export const actions: Actions = {
  discord: async (event) => {
    const slug = sessionSlug(me(event));
    const form = await event.request.formData();
    const raw = field(form, "url").trim();

    // Blank clears the webhook; anything else must be a real Discord one
    const url = raw ? discordWebhookUrl(raw) : null;
    if (raw && !url) {
      fail(
        "not a discord webhook",
        "That doesn't look like a Discord webhook URL. It should start with " +
          "https://discord.com/api/webhooks/ — nothing else is accepted.",
      );
    }
    await setDiscordWebhook(slug, url);
    redirect(303, "/settings?saved=1");
  },

  avatar: async (event) => {
    const slug = sessionSlug(me(event));

    // Refuse oversized bodies before reading them; the server has no body limit of its own
    const length = Number(event.request.headers.get("content-length"));
    if (!length || length > AVATAR_MAX_BYTES + 64 * 1024) {
      fail("image too large", `Avatars can be up to ${AVATAR_MAX_BYTES / (1024 * 1024)} MB.`, 413);
    }

    const form = await event.request.formData();
    const file = form.get("avatar");
    const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
    if (!(await saveAvatar(slug, bytes))) {
      fail("not an image", "Upload a PNG, JPEG, GIF or WebP image, up to 4 MB.");
    }
    redirect(303, "/settings?saved=1");
  },

  removeAvatar: async (event) => {
    await removeAvatar(sessionSlug(me(event)));
    redirect(303, "/settings?saved=1");
  },

  prefs: async (event) => {
    const slug = sessionSlug(me(event));
    const form = await event.request.formData();
    await setPrefs(slug, {
      defaultPrivate: form.get("default_private") != null,
      discordPrivate: form.get("discord_private") != null,
      mirrorAuto: form.get("mirror_auto") != null,
    });
    redirect(303, "/settings?saved=1");
  },
};
