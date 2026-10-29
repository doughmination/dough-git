/* src/routes/+layout.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { LayoutServerLoad } from "./$types";
import { config } from "#lib/server/config.ts";
import { sessionSlug } from "#lib/server/auth.ts";

export const load: LayoutServerLoad = ({ locals }) => {
  const user = locals.user;
  return {
    site: {
      title: config.title,
      favicon: config.favicon,
      description: config.description,
      baseUrl: config.baseUrl,
      themeColor: config.themeColor,
    },
    user: user
      ? {
          slug: sessionSlug(user),
          name: user.name,
          username: user.username,
          picture: user.picture,
        }
      : null,
  };
};
