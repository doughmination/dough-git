<!-- src/lib/components/Meta.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { page } from "$app/state";
  import { metaText } from "#lib";

  let {
    title,
    description = "",
    noindex = false,
  }: {
    title: string;
    description?: string;
    noindex?: boolean;
  } = $props();

  const site = $derived(page.data.site);
  const text = $derived(metaText(description || site.description));
  const url = $derived(site.baseUrl + page.url.pathname);

  // Theme colour as a number, e.g. "#eb459e" -> 0xeb459e
  const accentColour = $derived(parseInt(site.themeColor.replace("#", ""), 16));

  // Discord component embed: one Container, max 3,000 bytes, Open Graph tags are the fallback
  const componentEmbed = $derived({
    component: {
      type: 17,
      accent_color: accentColour,
      components: [
        {
          type: 9,
          components: [
            {
              type: 10,
              content: `## ${title}`,
            },
            {
              type: 10,
              content: text,
            },
          ],
          accessory: {
            type: 11,
            media: { url: site.favicon },
          },
        },
        { type: 14 },
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Open page",
              url: url,
            },
          ],
        },
        {
          type: 10,
          content: `-# ${site.title}`,
        },
      ],
    },
  });

  // Escape '<' so the JSON can't close the script tag early
  const toJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

  // Split closing tag so it doesn't end this script block
  const closingTag = "</" + "script>";
  const embedTag = $derived(
    `<script id='discord:component-embed' type='application/json'>${toJson(componentEmbed)}${closingTag}`,
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={text} />
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {:else}
    <link rel="canonical" href={url} />
  {/if}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={site.title} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={text} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={site.favicon} />
  <meta name="twitter:card" content="summary" />

  <!-- Built from page props, '<' escaped -->
  {@html embedTag}
</svelte:head>
