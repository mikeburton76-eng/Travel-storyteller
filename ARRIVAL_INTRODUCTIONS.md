# Arrival introductions

The separate `/drive-test` now supports settlement introductions worldwide where English Wikipedia has suitable source text and coordinates. Food and accommodation listings remain the Buxton/Tideswell trial.

An introduction leads with a sourced distinctive feature where one is available, then includes history and a dated population fact if supported. It links its sources. This path uses no paid AI API. Tideswell retains an explicitly dated 2011 parish statistic linked to the Peak District parish statement rather than conflicting later figures.

Each introduction has `checkedAt` and `reviewAfter` dates one calendar year apart. The next connected use after expiry retrieves source text again; there is no scheduled worldwide scan or independent verification of every fact. Up to 32 valid introductions persist in the phone's IndexedDB. The bounded server cache is in memory and resets on restart, so annual reuse across all visitors is not guaranteed. Existing Explore and stay-listing review policies are unchanged.

Automatic playback for arrivals and individual sights uses a 200-metre straight-line entry trigger around the saved coordinate. These are not road routes or administrative boundaries. Preparation can happen further ahead. A valid entry queues the item until it plays or the journey is stopped, even if the phone subsequently leaves the area. They accept a precise fresh GPS fix without needing speed or heading. Landmark triggers continue to use a directional corridor. Audio is prepared before the playback area; downloaded trip audio can work offline. Old trip downloads need preparing again to add an arrival introduction. Expired introductions require a connected refresh.

Before the next phone test, deploy this branch in Render, reopen `/drive-test`, use **Check Pippa first**, play the preview on the intended phone/car output and tap **I can hear Pippa**, prepare Buxton on Wi-Fi again and preview the saved arrival audio. Start while parked with precise location enabled; keep the page visible and screen awake. The test stops when the page is hidden and cannot detect or pause for Maps speech. Copy the test log if playback still fails.

Automated checks cover radial arrival triggers without a heading, offline playback once per session, stale GPS, non-blocking wake-lock startup, annual expiry, source selection and authenticated request validation. They do not establish successful playback on a real iPhone or explain the precise cause of the earlier Tideswell failure.

## Buxton follow-up after the silent journey test

The earlier “Automatic playback” entries only recorded Web Audio scheduling; Mike confirmed no voice was audible. The driving test now uses one native HTML audio element for the Pippa check, saved preview and journey clips. Logs distinguish playback requests, a `playing` event and an advancing media clock; none establishes audibility. A listener confirmation is required before GPS starts. Playback rejection and a ten-second clock stall leave a manual retry with a clear explanation. This is a candidate fix, not a verified iPhone fix. The main app's streaming voice implementation is unchanged.

Buxton is the default test location. Preparation resolves place choices through the existing free place search before requesting the guide, rather than submitting a qualified search string as an exact article title. Audio prepared online is retained in a bounded session cache for reuse after a signal drop; this cache does not replace explicit offline trip preparation and disappears on reload. Arrival profile revision 2 excludes former/Roman settlements and invalidates earlier cached arrival profiles; prepare existing offline trips again.

## Follow-up: parked check audible, journey items silent

Mike confirmed Pippa was audible in the parked check. A screenshot showed a prepared Staden introduction waiting about 2 km from its reference point. Inspection found that pending introductions were retained while they remained in the preparation area, and arrival candidates outranked landmarks even when a landmark had entered its playback area. The selection now ranks triggered candidates first and allows an in-range item to replace a pending out-of-range item. This fixes a reproducible starvation bug, without establishing the exact cause of every silent item on Mike's route.

The parked automatic playback check simulates arrival eligibility after five seconds, reusing a saved trip clip or the current session's Pippa check audio. It calls the actual automatic playback function on the same native player, without requesting GPS or extra speech. Stop or hiding the page cancels it. Audible success must still be confirmed by the listener. It does not test road geometry or GPS accuracy.

## Buxton feedback: remove repetitive advice and tighten distance

Mike confirmed hearing journey narration around Buxton on 2 November. He found the repeated eating/staying advice distracting and the playback area too broad. The generic visitor-information sentence is removed from arrival speech; introductions concentrate on the place itself. Arrival profile revision 3 refreshes cached introductions and prevents old downloaded arrival audio with that sentence from being reused; prepare offline trips again on Wi-Fi. The normal yearly source-review policy remains unchanged.

Previous arrival radii were 500 m for hamlets, 1,000 m for villages, 1,400 m for towns and 3,000 m for cities; landmarks triggered at 80–450 m ahead according to speed. Both now require a straight-line distance of at most 100 m. Landmarks still need the existing directional approach checks. Older broad radius metadata cannot override this limit. Preparation retains a separate, larger look-ahead area. A narrow trigger can miss places whose source coordinate is set back from the road or outside the road through the settlement; coordinates are not verified entrances. No left/right or route claims are introduced.

## Listening history and explicit replay

The driving test now stores per-place listening history in this browser's localStorage, independently of trip downloads, session restarts and refreshed recording keys. Automatic narration is allowed at most once per local calendar day. The optional **Skip familiar places after ten plays** setting is off by default and uses accumulated plays, not ten plays in one day. New counts start with this update; older journey logs are not imported.

A record is made when the native player clock first advances, not when a request is queued or audio is downloaded. Pippa previews and parked automatic sound checks do not count. Clock advancement does not establish actual audibility. **Hear this place again** grants one replay past the daily and optional ten-play limits, consumes that permission on playback progress and retains the accumulated count. It immediately replays valid audio already available on the phone; otherwise the permission applies to the next eligible pass. **Reset listening history** clears all place records while retaining the optional setting. History controls are disabled during driving/playback and preparation.

History belongs to this browser on this device, not a customer account. Clearing website data removes it. If browser storage is blocked or full, an explicit warning explains that protection persists only in the open page. No additional AI or data-provider requests are introduced by this history feature.

## 200-metre entry and latched playback

Mike reported silence despite a player-active message and correctly identified that prepared clips could be discarded after leaving the 100-metre area. The entry trigger is now 200 metres. Each valid approach is queued, including approaches during another clip. An entry stays eligible through delayed speech generation, moving past the place, a later missing/old GPS fix, and the gap between clips. New places still require fresh accurate GPS and the landmark direction checks. Pending preparation outside the entry area does not count as a queued visit. Stop, hiding the page or starting a fresh journey clears the queue; playback progress and daily history prevent repeats. A two-second evaluation timer services queued clips even without a new GPS callback.

The existing native media element now retains its loaded source when pausing between the parked check and journey clips, and replaces sources on that same element for subsequent clips. Explicit deletion releases it. Logs include mute, media-volume, ready-state and exposed audio-session state. This is a candidate improvement to the playback transition and diagnostics, not proof that iPhone or car output is audible. The player-active message explicitly says sound at the output is unverified. No per-place tap is intended during normal driving playback; a browser rejection still requires a safe user gesture, and the app cannot control system volume or the selected Bluetooth/car output.
