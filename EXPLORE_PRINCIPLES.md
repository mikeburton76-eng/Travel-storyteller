# Explore: editorial principles and first test version

## Purpose
Give a warm, factual sense of the location, then a useful selection of visitor experiences. A nearby encyclopedia article is a candidate, not automatically a recommendation.

## Sections
- **Main attractions:** defining, source-supported sights and experiences with a mix of nature, culture and activities. No more than two architecture entries in this first version.
- **Hidden gems:** worthwhile lesser-known places only where source text explicitly supports that status. Never fill the section merely because an entry is obscure.
- **Historic stories:** people, discoveries, traditions, engineering, everyday life and how places changed. A construction date alone does not qualify a building as a story.
- **Buildings & architecture:** worthwhile architecture, shown when supported entries exist.

A candidate may appear in up to three sections where each appearance supplies a distinct, source-backed angle. No duplicates within a section; no more than four repeated appearances across a guide, leaving room for other places. Near-identical reasons are rejected. Lists can be short or empty. No invented filler or implied completeness. Known closures and unsupported coordinates are omitted. City-wide distances and nearby searches are clearly distinguished. Villages use a six-kilometre area and towns twelve kilometres in this first version; cities allow a wider area. straight-line distance does not imply a walkable route or accessible venue.

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
- Defaults: 32 cached guides, two concurrent builds, 12 AI generation attempts per server process per rolling hour, 3,400 output tokens per attempt. These are workload limits, not a guaranteed account-wide monetary spending cap.
- The cache and counters are in memory and reset when the free server restarts. No background refresh while Render is asleep. A durable cache and an independent billing cap would be needed before a wider launch.
- `explore-config.json` contains adjustable limits and an `enabled` switch.

## Test and learn
Test Sydney, Melbourne, Los Angeles, San Francisco, Buxton and Tideswell as initial source retrieval checks. Follow with random cities, small towns, rural areas and ambiguous place names worldwide. Review the actual AI selection with the owner: major omissions, variety, category fit, genuine historical interest, family suitability, repeated cards, correct location/distance, pictures, source freshness and latency. Fix the retrieval/rules and repeat. Source-retrieval tests alone are not evidence that the real AI output is good.

The new page is served at `/explore` on the existing authenticated Render app; it uses `/api/explore`. The GitHub Pages prototype is a separate older experiment. No AI key is exposed to it.
