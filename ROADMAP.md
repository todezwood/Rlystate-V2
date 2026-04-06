# Rlystate V2 Roadmap

## About This Document

This is a living list of features and open questions for Rlystate V2. Items are grouped by theme, not priority. Priority gets set when we are ready to build.

Shervin and Jarmar are co-owners of this roadmap.

---

## Buyer Agent (Next Major Feature)

The current PoC has a seller agent that handles inbound negotiation. The buyer agent is the other half of the product and works in the opposite direction: the buyer describes what they want, and the agent hunts the inventory for them.

### How It Works (Concept)

1. **Buyer describes the item they want.** They can type a description and optionally upload reference photos. The description can be specific, for example "a couch like this photo but with slightly darker leather." The vision model reads the reference photos and the text together to build a preference profile.

2. **The agent scans inventory and surfaces candidates.** It returns a set of listings it thinks match. The buyer swipes yes or no on each one.

3. **The agent learns from the swipes.** Over time it homes in on what the buyer actually wants based on their yes/no pattern.

4. **When the buyer is ready, the agent negotiates on their behalf.** The buyer sets a maximum price. The agent handles the full negotiation with the seller agent and either reports back when a deal is locked, or checks in at a key decision point for the buyer to give final approval. This can be a toggle: fully autonomous mode or check-in mode.

### Open Questions to Resolve Before Building

- **Inventory search backend**: the current Postgres schema is not set up for semantic search. We will need to build a proper search layer, likely with embeddings or Elasticsearch, so the agent can find listings that conceptually match a buyer's description even when the wording is different. For example, "mid century modern dining table" should match a listing titled "vintage wood table with tapered legs." Flag this as a prerequisite infrastructure task.

- **Learning threshold**: how many yes/no swipes before the agent's suggestions meaningfully improve? Needs user testing to calibrate. Do not hardcode an assumption.

- **Negotiation autonomy toggle**: fully autonomous (agent negotiates and closes, buyer is notified at the end) vs. check-in mode (agent negotiates to a point, then asks the buyer for final approval). Both modes are valid. Consider making this a per-session setting the buyer chooses when they hand off to the agent.

- **Reference photo handling**: buyer uploads reference photos of what they are looking for, not what they are selling. The vision model interprets style, condition, color, and form from these photos as preference signals, not as item identification. This is a different prompt design than the seller listing flow.

---

## Known Beta Limitations to Address Before Launch

These are deferred items from the cloud migration that are fine for the PoC but need attention before real users.

- **Auth**: email/password only right now. Need Apple Sign In (required for App Store), Google OAuth, and LinkedIn OAuth for verified tier.
- **Payments**: deposit simulation only. Need Stripe Connect for real marketplace payments, deposit holds, and seller payouts.
- **Image uploads**: currently routes through the backend (direct upload). Switch to GCS signed URLs for scale to avoid bottlenecking the backend with large image payloads.
- **Rate limiting**: no rate limiting on the API. Fine for a handful of testers, needs to be added before public launch.
- **CI/CD**: deploys are manual gcloud and firebase commands. Set up GitHub Actions to automate on push to main.
- **Cloud SQL tier**: currently on a shared-core instance. Upgrade before real traffic.
- **Dispute resolution**: no flow yet for when a buyer claims an item is not as described. Open question from the original brief, still unresolved.

---

## Open Product Questions (From Original Brief)

These are unresolved strategic questions that Shervin and Jarmar need to answer together.

- **Buyer hook**: why does a buyer open this app instead of Facebook Marketplace? The seller value prop is clear. The buyer value prop is not solved yet. The buyer agent described above is one answer to this question.
- **Price floor threshold**: instinct is $100 minimum for launch vertical (furniture and large items). Needs validation.
- **Deposit vs. full payment**: leaning toward deposit to reduce buyer friction, but the percentage and refund policy are not defined.
- **NYC launch**: geo-focused launch in one city first. NYC is the likely candidate. Confirm before building geo features.
