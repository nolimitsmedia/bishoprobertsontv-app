# Adding a ministry

1. Copy the bishoprobertson-tv folder and rename it to the new ministry's
   folder name (lowercase letters, digits, dashes — e.g. grace-church).
2. Edit profile.json: site_name, short_name, description,
   site_url = https://tv.nolimitsmedia.com/<folder name>,
   api_url = the ministry's own API server, colors, timezone.
   Remove "community_channels" unless it has its own channels.
3. Replace icon-192.png and icon-512.png (required, exact sizes) and,
   optionally, logo.png, the other icons and content/ (pictures + defaults).
   Without content/, the site uses neutral wording.
4. Check it: node scripts/check-ministries.js <folder name>
5. Commit and push. The "Deploy ministries" action builds it and publishes
   https://tv.nolimitsmedia.com/<folder name>/ within a few minutes.
(This _example folder is ignored by the deploy: it has no profile.json.)
