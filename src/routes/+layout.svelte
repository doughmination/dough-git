<!-- src/routes/+layout.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import "#lib/styles/fonts.css";
  import "#lib/styles/theme.css";
  import "#lib/styles/global.css";
  import "#lib/styles/ui.css";
  import "#lib/styles/git.css";
  import Header from "#lib/components/Header.svelte";
  import Footer from "#lib/components/Footer.svelte";

  let { data, children } = $props();
</script>

<svelte:head>
  <meta name="theme-color" content={data.site.themeColor} />
  <link rel="icon" href={data.site.favicon} />
  <link rel="apple-touch-icon" href={data.site.favicon} />
</svelte:head>

<Header />
<main>
  {@render children()}
</main>
<Footer />
