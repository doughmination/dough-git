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
</svelte:head>
