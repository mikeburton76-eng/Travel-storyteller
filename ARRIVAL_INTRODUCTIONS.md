# Arrival introductions

The separate `/drive-test` now supports settlement introductions worldwide where English Wikipedia has suitable source text and coordinates. Food and accommodation listings remain the Buxton/Tideswell trial.

An introduction leads with a sourced distinctive feature where one is available, then includes history and a dated population fact if supported. It links its sources. This path uses no paid AI API. Tideswell retains an explicitly dated 2011 parish statistic linked to the Peak District parish statement rather than conflicting later figures.

Each introduction has `checkedAt` and `reviewAfter` dates one calendar year apart. The next connected use after expiry retrieves source text again; there is no scheduled worldwide scan or independent verification of every fact. Up to 32 valid introductions persist in the phone's IndexedDB. The bounded server cache is in memory and resets on restart, so annual reuse across all visitors is not guaranteed. Existing Explore and stay-listing review policies are unchanged.

Arrival triggers use approximate settlement areas, not road routes or administrative boundaries. They accept a precise fresh GPS fix without needing speed or heading. Landmark triggers continue to use a directional corridor. Audio is prepared before the playback area; downloaded trip audio can work offline. Old trip downloads need preparing again to add an arrival introduction. Expired introductions require a connected refresh.

Before the next phone test, deploy this branch in Render, reopen `/drive-test`, use **Check Pippa first**, play the preview on the intended phone/car output and tap **I can hear Pippa**, prepare Buxton on Wi-Fi again and preview the saved arrival audio. Start while parked with precise location enabled; keep the page visible and screen awake. The test stops when the page is hidden and cannot detect or pause for Maps speech. Copy the test log if playback still fails.

Automated checks cover radial arrival triggers without a heading, offline playback once per session, stale GPS, non-blocking wake-lock startup, annual expiry, source selection and authenticated request validation. They do not establish successful playback on a real iPhone or explain the precise cause of the earlier Tideswell failure.

## Buxton follow-up after the silent journey test

The earlier “Automatic playback” entries only recorded Web Audio scheduling; Mike confirmed no voice was audible. The driving test now uses one native HTML audio element for the Pippa check, saved preview and journey clips. Logs distinguish playback requests, a `playing` event and an advancing media clock; none establishes audibility. A listener confirmation is required before GPS starts. Playback rejection and a ten-second clock stall leave a manual retry with a clear explanation. This is a candidate fix, not a verified iPhone fix. The main app's streaming voice implementation is unchanged.

Buxton is the default test location. Preparation resolves place choices through the existing free place search before requesting the guide, rather than submitting a qualified search string as an exact article title. Audio prepared online is retained in a bounded session cache for reuse after a signal drop; this cache does not replace explicit offline trip preparation and disappears on reload. Arrival profile revision 2 excludes former/Roman settlements and invalidates earlier cached arrival profiles; prepare existing offline trips again.
