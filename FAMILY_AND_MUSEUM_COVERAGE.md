# Family and museum discovery

This is a small selection of ideas, not a directory or a promise of complete
coverage. No Manchester-specific attractions are hard-coded. City discovery
remains within 10 km of the chosen reference point.

## Sources and costs

- Existing Wikipedia/Wikivoyage searches now recognise indoor leisure activities.
  The same number of subject searches is used; some terms have been broadened.
- Up to six nearby museum articles share the existing full-text context request
  with walking articles. Only source-supported family activity paragraphs are used.
- A bounded OpenStreetMap query supplements bowling, miniature golf, laser tag, cinemas, escape rooms,
  indoor play, trampoline parks and museums worldwide where mapped.
- Public Overpass instances require no account or paid subscription. There are
  at most two attempts per lookup, eight seconds per attempt, and twelve outbound
  attempts per hour per provider. HTTP 429 stops retries. Results are cached for
  thirty days in bounded server memory; failures are held for five minutes.
  Restarting the server clears this cache. No availability guarantee is assumed.
- Map-only descriptions stay source-based and are excluded from paid AI prompts.
  Existing AI summaries and their existing budgets remain unchanged. No additional
  AI agent, paid data service, API key or billing integration has been introduced.
- Each mapped place links to OpenStreetMap, with contributor attribution in the
  area sources. A venue website appears only when an HTTPS URL is supplied.

## Selection and presentation

Museums and a variety of family activity types have space reserved within the
existing 48-candidate and 20-result budgets. Family and museum categories can
replace lower-priority rows when full; must-see and reviewed local records remain
protected. Thin sources are not padded with invented facilities, prices or ages.
Known private, closed, adult-only, out-of-range and unsuitable records are excluded.

Within History & culture, museums and galleries have one shared heading and short
subject overview. The existing reading/listening cards remain below it, sorted
by distance within that group. Other history cards retain their distance order.
Family activities has four activity-specific outward search links; History &
culture has a broader museum search link. This is a normal link, not a Google Places API
integration; Google determines its own search scope and results. Searches use the
resolved coordinates so a similarly named place abroad does not change the scope.

The free feed may be incomplete or unavailable. A failed lookup never stops the
encyclopedia guide, and coverage warnings remain visible. Age suitability and
current availability should be checked at the venue; the family category is a
list of ideas rather than an assurance that every venue suits every child.

## Verification

Fixtures cover coordinates in the UK, Australia and the US, radius enforcement,
exclusions, shared/cache reuse, source-only/no-AI behaviour, reserved category space,
and a single museum heading with individual reading and website links.
A live no-AI Manchester source check found Manchester Museum, Science and Industry
Museum and National Football Museum. The public activity feed was unavailable
during the initial live check; named leisure-venue coverage is therefore not yet
confirmed on the deployed app. Render deployment must be checked separately.


## Activity ideas that do not depend on a venue feed (version 15)

Family activities now also contains four small idea cards: Cinema, Bowling,
Escape rooms and Crazy golf. They offer possibilities, not recommendations or a
claim that a specific venue exists nearby. Each opens a normal Google Maps search
scoped to the resolved search coordinates. That service chooses its own results
and search range. No Google API, account, subscription or AI request is involved.

These cards render on the device, including for a saved older guide and when the
free venue feed fails or returns no results. Family activities therefore remains
available for a resolved location even without sourced family places. The idea
cards carry no invented venue, photo, distance, opening time or event date; they
are not added to guide.items, driving playback, narration or the AI prompt.
Existing sourced place cards and their reading/listening controls remain below
the ideas. The current two-column card layout and main category tiles are reused.

Global venue discovery now additionally recognises amenity=cinema and
leisure=escape_game. Known adult cinemas and disused cinemas are excluded. Film
certificates and escape-room age guidance vary; no all-ages suitability is assumed.
