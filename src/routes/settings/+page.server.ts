/* src/routes/settings/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { accountUrl, sessionSlug } from "#lib/server/auth.ts";
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
