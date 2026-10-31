# Arrival introductions

The separate `/drive-test` now supports settlement introductions worldwide where English Wikipedia has suitable source text and coordinates. Food and accommodation listings remain the Buxton/Tideswell trial.

An introduction leads with a sourced distinctive feature where one is available, then includes history and a dated population fact if supported. It links its sources. This path uses no paid AI API. Tideswell retains an explicitly dated 2011 parish statistic linked to the Peak District parish statement rather than conflicting later figures.

Each introduction has `checkedAt` and `reviewAfter` dates one calendar year apart. The next connected use after expiry retrieves source text again; there is no scheduled worldwide scan or independent verification of every fact. Up to 32 valid introductions persist in the phone's IndexedDB. The bounded server cache is in memory and resets on restart, so annual reuse across all visitors is not guaranteed. Existing Explore and stay-listing review policies are unchanged.

Arrival triggers use approximate settlement areas, not road routes or administrative boundaries. They accept a precise fresh GPS fix without needing speed or heading. Landmark triggers continue to use a directional corridor. Audio is prepared before the playback area; downloaded trip audio can work offline. Old trip downloads need preparing again to add an arrival introduction. Expired introductions require a connected refresh.

Before the next phone test, deploy this branch in Render, reopen `/drive-test`, use **Check Pippa first**, prepare Tideswell on Wi-Fi again and preview the saved arrival audio. Start while parked with precise location enabled; keep the page visible and screen awake. The test stops when the page is hidden and cannot detect or pause for Maps speech. Copy the test log if playback still fails.

Automated checks cover radial arrival triggers without a heading, offline playback once per session, stale GPS, non-blocking wake-lock startup, annual expiry, source selection and authenticated request validation. They do not establish successful playback on a real iPhone or explain the precise cause of the earlier Tideswell failure.
