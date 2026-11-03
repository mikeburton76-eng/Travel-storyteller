# Family and museum discovery

This is a small selection of ideas, not a directory or a promise of complete
coverage. No Manchester-specific attractions are hard-coded. City discovery
remains within 10 km of the chosen reference point.

## Sources and costs

- Existing Wikipedia/Wikivoyage searches now recognise indoor leisure activities.
  The same number of subject searches is used; some terms have been broadened.
- Up to six nearby museum articles share the existing full-text context request
  with walking articles. Only source-supported family activity paragraphs are used.
- A bounded OpenStreetMap query supplements bowling, miniature golf, laser tag,
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
Family activities and History & culture each have a single outward Google Maps
search link for a broader choice. This is a normal link, not a Google Places API
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
