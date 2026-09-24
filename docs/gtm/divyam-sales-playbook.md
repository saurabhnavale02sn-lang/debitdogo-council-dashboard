# Divyam.AI — Founding AE Sales Playbook

**Operating manual: workflows, outbound motion, qualification, pilot-to-close**
Saurabh Navale · 24 September 2026 · Companion to the 8-slide GTM Blueprint

> The deck says *what* I'd sell and to whom. This says *how I'd run the week*. Paste into Notion — headings and tables map 1:1.

---

## 1. Operating Cadence

The week is fixed. Deals move because the calendar makes them.

| Block | When | What happens | Non-negotiable |
|---|---|---|---|
| **Prospecting** | Mon + Wed, 08:00–11:00 | New account research, Tier-1 hand-written emails, list verification | 3 hrs × 2 = **no meeting may be booked here** |
| **Live selling** | Tue, Thu, 14:00–18:00 | Discovery, technical deep-dives, pilot reviews | Prospects get the best hours, not the leftovers |
| **Follow-up burst** | Daily, 11:00–12:00 | Sequence touches, replies, LinkedIn, inbound SLA | Inbound lead answered **inside 4 working hours** |
| **Pilot engineering** | Fri AM | Sit with eng on live POCs, unblock, write success docs | AE owns the doc, not the engineer |
| **Pipeline hygiene + inbound** | Fri PM | CRM true-up, forecast, 1 technical post, benchmark work | Stale stage = stage reset, no exceptions |

**Daily floor:** 25 touches, 5 new accounts researched, 0 deals left in a stage past its clock.

---

## 2. Pipeline Stages & Exit Criteria

Stages are defined by **what the buyer did**, never by how the call felt.

| # | Stage | Exit criteria (all must be true) | Clock |
|---|---|---|---|
| **0** | Researched | Account has AI in production, est. spend > $10k/mo, 3 personas named | — |
| **1** | Engaged | Human reply that isn't "no" | 12 days |
| **2** | Discovery | Workload named, current model named, **₹ spend quantified**, pain owner identified | 10 days |
| **3** | Technical validation | AI Infra Lead has seen the router demo and **stated a quality bar** | 14 days |
| **4** | Pilot scoped | One workload, success metric written, dates + eng named, **signed** | 7 days |
| **5** | Pilot running | Baseline captured, traffic routed, weekly readout scheduled | 30 days |
| **6** | Business case | ₹ saved verified, champion presents internally, procurement + security started | 21 days |
| **7** | Closed | Signed contract | — |

**Stage-2 gate — the one that matters:** if I cannot state *their* monthly inference spend and *which* workload we'd attack, the deal is not in Discovery. It's still Engaged.

---

## 3. Qualification — MEDDPICC, wired for Divyam

| Letter | What I need on the record | The question that gets it |
|---|---|---|
| **M**etrics | Monthly inference spend, target reduction %, the quality bar | "What did inference cost you last month, and what's the number that makes this worth doing?" |
| **E**conomic buyer | Who owns the AI line in the budget | "Whose P&L does this bill land on?" |
| **D**ecision criteria | Quality floor, latency ceiling, deployment mode | "What would have to be true for you to route 50% of traffic to an open model?" |
| **D**ecision process | Security review, procurement, who signs at what ₹ | "Walk me through the last infra tool you bought — how long, and who blocked it?" |
| **P**aper process | DPDP/security questionnaire, MSA, data processing terms | "Does this need to clear a security review before a pilot, or only before production?" |
| **I**dentify pain | Margin pressure, model inertia, an AI feature that's over budget | "When did you last change the model behind your highest-volume endpoint?" |
| **C**hampion | AI Infra Lead who will run the pilot internally | "Who on your side would actually wire this up?" |
| **C**ompetition | Portkey, in-house router, or status quo (usually status quo) | "If you did nothing for two quarters, what happens to the bill?" |

**Disqualify immediately if:** no AI in production · under ~$10k/mo inference · no named workload by call two · no exec sponsor by call three · "we're building this internally" and they've already shipped it.

Disqualifying early is the job. A bootstrapped startup dies of **too many open deals**, not too few.

---

## 4. Outbound Motion

### 4.1 List build
- **50 accounts**, hand-picked on: AI in production + thin unit margin + public evidence of scale.
- **~200 contacts**, 3–4 per account: VP Platform Eng, AI Infra / ML Platform Lead, Head of Support Ops (where the workload lives), CTO.
- Verified manually. **No purchased lists** — a 15% bounce rate kills domain reputation, and we can't buy a new one.
- **Trigger events that move an account to the top:** a hiring post for LLM/inference engineers, a public AI feature launch, a cost-related engineering blog post, a funding round, a new CTO.

### 4.2 Tiering

| Tier | Count | Treatment | Effort |
|---|---|---|---|
| **Tier 1** | 15 | Fully hand-written. I model their inference spend *before* first contact and put the number in email one. | ~25 min/account |
| **Tier 2** | 35 | Segment-templated, manually verified, one specific detail per message | ~6 min/account |

### 4.3 The sequence — 5 touches, 12 days

| Day | Channel | Job of the touch |
|---|---|---|
| 1 | Email | One specific observation + the cost thesis. **No calendar link.** |
| 3 | LinkedIn | Connect with the champion. No pitch. |
| 5 | Email | The MakeMyTrip 63% teardown as an artifact |
| 8 | Email | The disqualifying question, sent cold |
| 12 | Email | Break-up + cost calculator, permission to close the file |

### 4.4 The actual copy

**Touch 1 — Tier 1, AI Infra Lead**

> **Subject:** your tier-1 support queries
>
> [Name] — you're running [assistant] on [model] for first-line support. At your volume that's roughly **₹X–Y lakh a month**, and my guess is 70–80% of those queries are order status and refund lookups that a Llama-class model answers identically.
>
> The reason nobody moves them is that you can't prove quality holds. We build the proof first, then move the traffic.
>
> Worth 20 minutes?
>
> Saurabh

**Touch 3 — the artifact**

> **Subject:** 63%, zero quality loss
>
> MakeMyTrip ran this on Myra — **cut LLM cost 63% with no quality regression.** Method, not marketing: [link].
>
> The part that matters for you is the rubric step. They defined quality on their own data before a single request was rerouted.

**Touch 4 — the disqualifier**

> **Subject:** one question
>
> Does your current gateway automatically benchmark DeepSeek against your production data overnight and switch traffic by morning — without an engineer approving it?
>
> If yes, I'll close the file and genuinely want to know how you built it. If no, that gap is what we sell.

**Touch 5 — break-up**

> **Subject:** closing the file
>
> Haven't landed this, so I'll stop. If inference cost becomes a board conversation next quarter, here's a calculator that'll model the saving in two minutes: [link].
>
> Good luck with [feature].

**Rules:** one falsifiable claim per email · never two personas the same artifact · no "quick chat", no "circling back", no calendar link before a reply · every claim survives being challenged by an engineer.

---

## 5. Discovery Call — 30 minutes

| Min | Segment | Purpose |
|---|---|---|
| 0–2 | Frame | "I've got three questions. If the answers say we're not a fit, I'll tell you and give you the time back." |
| 2–12 | **Current state** | Workload, model, volume, monthly spend, who owns the bill |
| 12–20 | **The quality bar** | How do they judge output today? Human review? Sampling? Nothing? *This is where EvalMate sells itself.* |
| 20–26 | **Mechanism, not demo** | Route → Evaluate → Optimise, against *their* workload. Whiteboard, not slides. |
| 26–30 | **Close to next step** | Technical deep-dive with the infra lead, dated before we hang up |

**The eight questions:** monthly spend · which workload is biggest · which model and why that one · when it was last changed · how quality is judged today · what breaks if quality drops · deployment constraints (VPC? air-gap? DPDP?) · who else must agree.

**Red flags:** "send me a deck" (no pain) · can't name spend (wrong person) · "we'll look at it next quarter" (no urgency) · champion won't introduce anyone (no internal capital).

---

## 6. Pilot Workflow — the 30 days that close the deal

| Phase | Days | Deliverable | Owner |
|---|---|---|---|
| Scope | 1–3 | **One-page pilot doc**: workload, quality bar, success metric, dates, named people — signed by both sides | **Me** |
| Baseline | 4–7 | Current cost + quality measured on their traffic. *No baseline, no pilot.* | Their eng + ours |
| Rubric | 8–12 | EvalMate rubric built on their examples; champion signs off the quality definition | Ours |
| Route | 13–25 | Traffic shifted progressively. Weekly 20-min readout, every week, no exceptions | Me + champion |
| Readout | 26–30 | **₹ saved at constant quality**, in their finance team's units, presented *by the champion* | Champion presents, I support |

**The one-page pilot doc is the whole discipline.** Unsigned pilots slip, expand, and die quietly. Signed ones produce a number, and a number survives a budget meeting I'm not in.

**Success metric wording that works:** *"≥30% reduction in blended cost per request on [workload], with rubric score within 2% of baseline, measured over 14 days of production traffic."*

---

## 7. Objection Playbook

| Objection | Response | Proof point |
|---|---|---|
| "You're unfunded." | Remove the dependency: air-gapped, runs in their VPC. Our disappearance doesn't touch their inference. | Deployment architecture |
| "We use Portkey." | "Keep it — that's plumbing. I sell the decision layer above it." | The overnight-benchmark question |
| "Won't OpenAI build this?" | No provider is paid to route you off its own model. **Neutrality is the product.** | Structural, not speculative |
| "Quality will drop." | That's the product. Quality is the gate, not the hope — the rubric is yours and runs on your metal. | EvalMate → router gating |
| "We'll build it internally." | "You can. It's 2–3 engineers for two quarters, plus maintenance forever. What else are those two quarters worth?" | Build-vs-buy math |
| "No budget." | Wrong budget line. This isn't tooling spend — it's cost of goods. Pilot pays for itself inside 30 days. | Pilot savings number |
| "Come back next quarter." | "Fine — but the inertia cost is ₹X lakh a month. Can I send one benchmark a month so the number's ready when you are?" | Nurture, not a dead deal |

---

## 8. Inbound Handling

| Source | Routing | SLA |
|---|---|---|
| Free cost audit request | Straight to my calendar. **Highest intent we have.** | Same day |
| Benchmark report download | Enrich → if ICP, personal note referencing which report | 24 hrs |
| OSS calculator / GitHub | Watch stars + issues; engage technically, never pitch in a thread | Opportunistic |
| Comparison-page traffic | "Portkey alternative" visitors are in an active evaluation — treat as Stage 1 | 4 hrs |

**Instrumented from day one:** every lead carries a source, and I report inbound-sourced pipeline separately — so any play that isn't earning its time gets killed on evidence.

---

## 9. CRM & Forecast Discipline

**Required on every opportunity:** monthly inference spend · target workload · current model · quality bar (verbatim) · champion + economic buyer · next step **with a date** · security/procurement status.

| Category | Means | Test |
|---|---|---|
| **Commit** | Pilot delivered a number, champion has presented it, paper in motion | I'd bet my quota on it |
| **Best case** | Pilot running, baseline captured | Needs the number to land |
| **Pipeline** | Discovery done, spend quantified | Not yet validated |
| **Omitted** | Everything else | Say so early, loudly |

**No next step with a date = not a deal.** It moves back to Engaged at Friday hygiene, whoever it upsets.

---

## 10. Metrics I'd Report Weekly

| Layer | Metric | Target |
|---|---|---|
| Activity | New accounts researched / contacts touched | 50 / 200 per month |
| Efficiency | Reply rate · reply→meeting | 10% · 50% |
| Pipeline | Technical discoveries · pilots scoped | 15 · 3 (first 30 days) |
| Quality | Pilots hitting their success metric | **>70%** — below that, we're scoping badly |
| Velocity | Days from first reply to signed pilot | < 30 |
| Compounding | Inbound-sourced pipeline as % of total | 0% M1 → 20% M6 |

**Leading indicator I'd actually watch:** *number of accounts where I can state their monthly inference spend.* Everything downstream follows that one number.

---

## 11. Week One Checklist

- [ ] 50 accounts researched, 200 contacts verified, tiered 1/2
- [ ] Inboxes warmed, sequencer + CRM live, stages and required fields configured
- [ ] Tier-1 spend models built for the first 15 accounts
- [ ] Touch-1 copy written per persona, reviewed with Sandeep
- [ ] Pilot one-pager template drafted and agreed with engineering
- [ ] Free cost-audit landing page live
- [ ] Two warm Flipkart-network intros requested
- [ ] First 50 Tier-1 emails sent by Friday

---

### Open questions for Sandeep
1. **Pricing:** share of verified savings, platform fee, or per-token? Sets ACV and who's in the room.
2. **Pilot capacity:** how many concurrent pilots can engineering support? That caps my pipeline, not my activity.
3. **Product:** does the router work per-step inside agent workflows, or only per-prompt?
4. **Trust:** security questionnaire pack or SOC 2 path — build, buy, or route around with air-gap?
5. **Moat:** when Portkey ships evidence-based routing, what still can't they copy?
6. **Definition of win at Day 90:** logos, revenue, or a repeatable motion?
