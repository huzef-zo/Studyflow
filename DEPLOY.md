# Deployment Checklist

Before pushing any code change:

1. Open `version.js`
2. Increment the version string:
   - Same day as last deploy: bump the counter (01 → 02)
   - New day: use today's date and reset counter to 01
   - Example: `v2025-05-03-01` → `v2025-05-03-02` or `v2025-05-04-01`
3. The version string in version.js is automatically used by:
   - sw.js (via importScripts)
   - All HTML files link tags (manual update required — see step 4)
4. In ALL .html files, update the ?v= query on every local <script> and <link>
   to match the new version string
5. Commit everything together in one commit
6. Deploy

Never deploy without bumping the version. Users on the old version will
continue to see cached CSS/JS until they get a new service worker,
which only happens when CACHE_NAME changes.
