<!-- src/lib/components/Footer.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcFavorite from "~icons/ic/outline-favorite";
  import "#lib/styles/footer.css";
  import { page } from "$app/state";
  import { mainSite } from "#lib";

  const site = $derived(page.data.site);
</script>

<footer>
  <p class="footer-line">
    <span class="footer-brand">
      {#if site.favicon}
        <img src={site.favicon} alt="" width="20" height="20" />
      {/if}
      {site.title} &middot; a minimal git mirror
    </span>

    <span>
      part of <a href={mainSite}>doughmination.gay</a>
      <IcFavorite class="icon beat" width="16" height="16" />
    </span>

    <span>Clove Twilight &copy; 2026</span>
  </p>
</footer>
