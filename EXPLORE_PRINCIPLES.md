# Explore: editorial principles and first test version

## Purpose
Give a warm, factual sense of the location, then a useful selection of visitor experiences. A nearby encyclopedia article is a candidate, not automatically a recommendation.

## Sections
The icon grid also includes **Summary of the place**, **Walks**, **Photo opportunities**, **Family activities**, and **Museums & galleries**, with a short customer description under every heading. Secondary lenses require their own source evidence; do not infer family suitability, an easy walk or a viewpoint from a picture alone.

- **Main attractions:** defining, source-supported sights and experiences with a mix of nature, culture and activities. Architecture diversity is encouraged, but locally listed must-see highlights are not discarded under the general two-building ceiling.
- **Hidden gems:** worthwhile lesser-known places only where source text explicitly supports that status. Never fill the section merely because an entry is obscure.
- **Historic stories:** people, discoveries, traditions, engineering, everyday life and how places changed. A construction date alone does not qualify a building as a story.
- **Buildings & architecture:** worthwhile architecture, shown when supported entries exist.

A candidate may appear in up to four sections where each appearance supplies a distinct, source-backed angle. No duplicates within a section; a bounded number of repeated appearances across a guide, leaving room for other places. Near-identical reasons are rejected. Lists can be short or empty. No invented filler or implied completeness. Known closures and unsupported coordinates are omitted. City-wide distances and nearby searches are clearly distinguished. Villages use a six-kilometre area and towns twelve kilometres in this first version; cities allow a wider area. straight-line distance does not imply a walkable route or accessible venue.

## Family content
Exclude massacres, school shootings and other shootings, rape, sexual abuse, violent crime, suicide, torture, terrorism, graphic or distressing accounts, and adult venues. Do not rename a harmful event to disguise it as a cheerful attraction. Keyword screening supplements AI editorial review and cannot guarantee semantic or pixel-level suitability. Reported failures require rule and regression-test updates.

## Retrieval and AI
The initial provider layer uses English Wikipedia background/geosearch/subject searches, Wikivoyage visitor listings and district guides, Wikidata identity/coordinate reconciliation, and Wikimedia Commons photo metadata. Providers are replaceable. There is no dependence on a hard-coded city collection. Other languages, official tourism/venue sources and stronger opening-status verification remain future work.

AI receives bounded source-backed candidates with distances and source evidence. It may choose candidate IDs and approved image IDs only. Reasons require literal supporting source quotes. A friendly overview requires area evidence. Confidence, family review, section eligibility, source support, architecture limits and duplicate checks run in code after generation. These checks reduce errors; they do not prove every model claim factually correct.

Pictures require an allowed Commons host, a recognised reusable licence, creator credit and source page. AI reviews the supplied metadata for relevance/suitability. This version does not perform visual image moderation; an icon is used when selection or credit is uncertain. Photo attribution is shown in the reading panel.

If AI cannot run, the page clearly labels a limited source-based selection rather than presenting it as a ranked top list. Open source-background text separately from the short editorial reason. Narration remains a separate replaceable component.

## Refresh and costs
- Check sources again after six hours when a guide is next used; a visible page checks whether its guide is due every ten minutes and on return to the tab.
- Hash the evidence and photo metadata. Reuse an unchanged AI selection instead of paying to generate it again.
- Show the source-check time and next due time; keep the AI-review time separately.
- Distinguish attempted/source checks from live-verified opening hours and availability. Venue status must still be checked before travelling.
- Use the existing protected AI key/model, one bounded generation per changed guide. No new paid provider or database.
- Defaults: 32 cached guides, two concurrent builds, 12 AI generation attempts per server process per rolling hour, 5,200 output tokens per attempt. These are workload limits, not a guaranteed account-wide monetary spending cap.
- The cache and counters are in memory and reset when the free server restarts. No background refresh while Render is asleep. A durable cache and an independent billing cap would be needed before a wider launch.
- `explore-config.json` contains adjustable limits and an `enabled` switch.

## Test and learn
Test Sydney, Melbourne, Los Angeles, San Francisco, Buxton and Tideswell as initial source retrieval checks. Follow with random cities, small towns, rural areas and ambiguous place names worldwide. Review the actual AI selection with the owner: major omissions, variety, category fit, genuine historical interest, family suitability, repeated cards, correct location/distance, pictures, source freshness and latency. Fix the retrieval/rules and repeat. Source-retrieval tests alone are not evidence that the real AI output is good.

The new page is served at `/explore` on the existing authenticated Render app; it uses `/api/explore`. The GitHub Pages prototype is a separate older experiment. No AI key is exposed to it.

## Castleton coverage regression (28 October 2026)
Mam Tor was excluded by the original visitor-type filter, which omitted hills/mountains. Blue John Cavern was retrieved but could be lost under the basic fallback’s two-per-theme cap. The Wikipedia title “Castleton, Derbyshire” also failed to find Wikivoyage’s shorter “Castleton” guide.

The provider now recognises wider natural features; tries a shorter travel-guide title only after checking its coordinates against the requested location; follows named links in tourism/attraction sections; keeps supported local highlights before trimming the candidate pool; and checks whether the final must-see selection omitted any of them. The source-based fallback prioritises these highlights and allows up to twelve main sights instead of imposing a two-per-type cutoff. AI receives the must-see flags and secondary category evidence requirements.

These rules are generic. Castleton is a regression fixture, not a hard-coded production place list. The direct live-source check recovered Mam Tor, Blue John Cavern, Peak Cavern, Speedwell Cavern, Treak Cliff Cavern, Winnats Pass, Cave Dale and Peveril Castle. Continued random-place testing is required; the shortlist is not guaranteed to be exhaustive.

## Earlier first results

The Explore client requests progressive results. A small source-screened nearby preview can appear before broader discovery completes, then fuller source cards and licensed image metadata appear before AI review finishes. These provisional cards are explicitly labelled, not presented as a ranked top list. Empty categories say they are still preparing. Regular background refreshes retain the previous complete guide until a replacement is ready.

Repeated polls share the same in-memory build and AI call. Completed guides retain the existing bounded cache. Pictures load independently in the browser; failed pictures retain an icon. This does not remove free-host cold starts or guarantee a particular first-result time. The non-progressive API remains compatible.

## Explore backlog — category coverage and specialist agents (28 October 2026)

- **Next approach:** improve separate category searches running together, followed by one shared AI review. Populate family activities, walks, photo opportunities, museums and galleries, and other relevant categories with source-supported suggestions and matching licensed pictures. This is planned improvement work, not a claim that coverage is complete.
- **Potential future action — specialist AI agents:** retain the option of a separate researcher for family activities, another for walks, and other categories where useful. Revisit if testing shows the shared approach still misses good suggestions; do not enable extra agents or paid calls by default.
- Family research should look for explicit activities for children/families and documented age guidance. Walk research should find established routes with sourced distance, terrain and difficulty where available. Missing practical information must remain unknown, not guessed.
- All researchers must return source evidence and relevant image candidates with licence/credit information. A shared review enforces family content rules, location accuracy, category fit and justified overlap without crowding out other places.
- Compare against the shared approach on coverage, image relevance, first-card delay and AI cost. Test villages, towns and large cities before deciding whether specialist agents justify their additional cost and complexity. Keep the implementation replaceable.

## Optional specialist trial — implemented, 28 October 2026

The unchecked “Try richer family and walking suggestions” option requests two bounded specialist selectors alongside the main selector. Each uses the existing AI account/model, a maximum 16 evidence-matching candidates, at most four choices and 1,800 output tokens. They are grounded selectors, not autonomous web-browsing agents. The shared source provider now includes additional walking and children's activity searches. The normal unchecked route still uses one review; the trial can use up to three. All calls share the existing hourly limit. Disable with `specialistTrialEnabled: false`.

Specialists can independently nominate a source candidate without its first appearing in main attractions. Central checks enforce source IDs, literal category evidence, family screening, confidence, matching licensed image IDs, duplicate/overlap and category limits. Trial results have a separate 28-card ceiling (normal guide remains 20) to leave room for additions. “Family-owned” is not evidence of a family activity; “walking distance from the station” is not a walking attraction. Age, access and difficulty are not guaranteed or inferred.

Trial caches are separate from normal guides. Progressive source cards remain available before AI completion; one failed specialist leaves other results usable. The checkbox is off by default because of extra account usage. Unit/integration tests use controlled AI responses; these do not establish real model editorial quality. Real destination output and latency must be compared after deployment before enabling this by default. Existing source gaps and keyword-based moderation limitations still apply.

Trial source checks (no paid AI calls): Castleton retrieval returned 23 candidates and 14 licensed images; Buxton 24 and 17; Sydney 48 and 34. Category evidence was much thinner than general visitor coverage: explicit family activity language was absent in these Castleton/Buxton pools and present for Petersham Park in Sydney. Walking-related evidence existed in all three, but a mention alone is not a valid walk recommendation. These are source-pool observations, not validated specialist output. Broader venue/tourism sources remain a likely next step for family coverage. Additional bounded OR searches and category reservations were added following this check; final real-model coverage still needs live review.

## Five-category presentation trial — 29 October 2026

Explore now presents five customer choices: Must-see sights, Hidden gems, Walks & outdoors, Family activities, History & culture. The place introduction remains above the category choices once a guide arrives. Existing research sections remain intact and reversible: buildings feed sights and heritage; museums/galleries feed culture; evidenced outdoor nature places join documented walks with a distinct card label. Photo opportunities become a Photo spot badge on matching cards. Duplicate IDs appear only once within each displayed category; justified overlap between categories remains. No new AI calls are introduced by this presentation change. Photo cards, reading panels and maps remain available.

## Buxton station and empty-category correction — 29 October 2026

The broad visitor filter admitted ordinary railway stations and depots; the source-only backup then placed every entry in attractions. This can explain a station-heavy main list and empty remaining categories, although the user's exact live selection mode was not captured.

A shared visitor suitability check now excludes ordinary stations/depots unless their source explicitly describes a visitor attraction such as a heritage railway or railway museum. The check applies to source candidates, early cards, fallback and AI-approved choices. It does not ban railway history stories.

Source-only backup and category supplementation can now independently publish literal, screened source descriptions for walking, explicit family activities, named museums/galleries, genuine historical topics and explicitly evidenced hidden gems. They respect existing result/category/overlap limits and are labelled as source-based. No invented family suitability or hidden-gem filler is added. An empty/invalid AI selection falls back candidly rather than showing an empty guide. These changes do not add AI calls.

Image matching normalises underscores to spaces, addressing Wikimedia filenames that previously failed to attach their already-licensed image metadata. Backup cards retain these matching credited images.

Live Buxton source retrieval followed by local source-based selection returned no station cards, walking suggestions, museum/history entries and ten cards with matched photographs. Family and hidden-gem evidence remained insufficient in this retrieval. This is not a live AI-output or current-opening-status verification. 49 automated checks passed; two unchanged voice integration checks remained skipped.

## Empty categories and visitor information — 29 October 2026

Before searching and during progressive preparation, all five category choices remain visible. Once a guide is complete, only categories with displayable cards are shown. If the current category becomes empty, the first populated category is selected. A guide with no attractions has no empty category buttons and retains any visitor information panel.

Visitor information now has a separate practical panel independent of AI attraction ranking. A bounded OpenStreetMap Overpass query looks for tourism=information with information=office/visitor_centre/visitor_center, excludes boards, remote/private/explicitly closed records, deduplicates nearby offices, and shows at most three entries. It runs alongside source discovery, with a nine-second failure limit; it adds no AI calls. Website fields become HTTPS links only and are never fetched by this module. OpenStreetMap attribution and source links are displayed. Public service availability and mapped status are not guaranteed.

Buxton's operator confirms the visitor centre is the Pump Room, opposite the Crescent: https://buxtoncrescentexperience.com/visitor-information/ and https://buxtoncrescentexperience.com/contact/ (checked 29 October 2026). A small source-verified visitor-service supplement retains this entry even when the public map lookup fails. Its address-based map search avoids inventing precise office coordinates. This maintained supplement is explicitly separate from the generic attraction ranking and may be extended after verifying other visitor centres. Opening hours are not stored or promised.

The live public map request timed out during development, so general lookup behavior is covered by controlled responses rather than claimed live coverage. 54 automated checks passed, including hiding empty categories, selection recovery, visitor information without attractions, office filtering and Buxton fallback under outage. Two unchanged voice integration checks remained skipped.
