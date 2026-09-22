# Go-To-Market Blueprint: Divyam.AI

**90-Day Execution Strategy for Founding AE**
Prepared for: **Sandeep Kohli, CEO** · Presenter: **[My Name]** · Date: **22 Sep 2026**

> Format note: written for Notion. Paste as Markdown — headings, tables and callouts map 1:1. Nothing here is a slide; it is the operating doc I'd run the first quarter from.

---

## 0. TL;DR — The Thesis in Five Lines

- Divyam is not an observability vendor. **Dashboards are a cost centre; Divyam is a P&L line item.**
- The wedge is the **closed loop**: EvalMate sets the quality bar, Model Router enforces it, traffic moves without a human in the loop.
- Proof already exists: **MakeMyTrip cut LLM costs 63% with zero quality loss** on Myra. That is the entire first-call deck.
- We cannot outspend **Portkey ($15M Series A, Elevation + Lightspeed)**. We out-architect them and out-work them on targeted outbound.
- 90-day target: **40 qualified technical discos → 12 paid pilots-of-one-workload → 3 logos closed.**

---

## 1. The Market Reality

### The core problem
- Inference cost scales with **usage, not headcount**. Every successful AI feature makes gross margin worse.
- **GPT-4o ≈ $2.50 / $10 per 1M tokens in/out. DeepSeek-flash ≈ $0.30 / $1.20. Llama 4 Scout ≈ $0.10 input.** An **8–20x** spread sits unclaimed on the table.
- Nobody moves traffic to the cheap model because **nobody can prove quality holds**. That fear — not the price list — is the real product gap. Divyam calls it *model inertia*; it is the most commercially useful phrase we own.
- Token prices have fallen ~300x since 2023 and enterprise bills went **up**. Volume ate the savings. This is the "LLMflation" story and it lands with every CFO.

### US market context
- Heavily funded, converging on **broad AI observability**: traces, spans, scores, dashboards.
- Braintrust raised one of 2026's largest rounds in eval/observability. LangSmith owns the LangChain-native install base.
- Their buyer is the **AI engineer debugging quality**. Ours is the **exec defending margin**. Different wallet, different urgency.

### India market context
- **Hyper cost-conscious.** Indian enterprises buy ROI in a quarter, not a platform vision in a year.
- **Data sovereignty is contractual, not aspirational.** DPDP + sectoral rules (RBI payment-data localisation) mean BFSI and fintech buyers need in-country or in-VPC evaluation before anything touches a US API.
- **Budget scrutiny is real:** DPDP compliance programmes alone are running **₹15–60 lakh** for large enterprises. Any new AI vendor competes against that spend.
- Consequence: an **air-gapped, self-hosted deployment is not a feature — it is the entry ticket** to the top 50 accounts in this market.

---

## 2. The Competitive Landscape

| Player | Funding / Position | What they do | Where they lose to us |
|---|---|---|---|
| **Braintrust** | Best-funded in eval category | Eval-first, framework-agnostic, scoring + datasets | Scores tell you what broke. A human still fixes it. |
| **LangSmith** | LangChain-native, enterprise tier | Traces, evals, managed agent deploy | Locked to LangChain-shaped stacks; observability-first, not cost-first |
| **TruEra / Arize** | Acquired / enterprise-scale | Model monitoring, drift, explainability | ML-era posture; not built to move live GenAI traffic |
| **Portkey.ai** | **$15M Series A** (Elevation, Lightspeed). 500B+ tokens, 125M daily requests, 24k+ orgs | AI gateway + governance + budgets + guardrails | Routing rules are **static and human-authored**. Fallbacks ≠ evidence-based promotion. |
| **Maxim AI** | **$3M seed** (Elevation) | End-to-end simulation, evals, observability | Evals are a **destination**, not a control signal. No traffic control plane. |
| **Simplismart** | $7M Series A; reported **~$20M round with Nvidia interest** | BYOC / on-prem inference, GPU utilisation | Optimises **how** a model runs. Never asks **which** model should run. |

### The bootstrapped reality — stated plainly
- We will lose every paid-search, conference-booth and content-volume fight. Portkey has 15M reasons to win those.
- **We win on architecture and on reps.** 100 surgical, technically-literate touches beat 100,000 impressions.
- Our unfair advantages are exactly three: **the closed loop**, **air-gapped deployment**, and **a founder-led sales motion that ships a POC in the same week it's scoped**.
- Corollary: **no top-of-funnel spend in the first 90 days.** Every rupee goes to data, tooling and POC engineering.

---

## 3. The Divyam Wedge — Closed-Loop Architecture

### The moat in one sentence
> Everyone else measures quality. **Only Divyam lets quality automatically authorise a cheaper model.**

### How the loop works
1. **EvalMate defines the baseline.** An agentic workflow turns *your* examples into a structured rubric — your definition of quality, not MMLU. The aligned judge distills into an **~8B reward model that runs on your own infrastructure**. Quality is now a live, in-house signal.
2. **Model Router enforces it.** A lightweight classifier routes every prompt across **100+ models** against your cost ceiling and quality floor. Trivial queries drop to cheap models; hard ones escalate to frontier.
3. **The loop closes.** Route → Evaluate → Optimize → Repeat. New model lands Tuesday, it is benchmarked against your traffic overnight, promoted by morning **only if the rubric holds**.

### The commercial claim
- **Automated cost arbitrage without quality degradation. Zero human intervention.**
- Evidence: **MakeMyTrip / Myra — 63% LLM cost reduction, zero quality loss.**
- The killer framing for a CTO: *"Your model choice is a decision you made once, nine months ago, and have been paying for every day since."*

---

## 4. Blockers & Objection Handling

### Blocker 1 — "You're unfunded. I can't put you in the production path."
- **Do not argue the balance sheet. Remove the dependency.**
- Lead with **air-gapped / privately hosted deployment**: the router and the ~8B judge run inside their VPC. No traffic leaves. **Divyam going away tomorrow does not take their inference down.**
- Then de-risk commercially: **one workload, 30-day paid pilot, success = a number** (₹ saved at constant quality), monthly terms, exit clause.
- Reframe: "You are not betting your infra on us. You are renting an optimisation loop that runs on your own metal."

### Blocker 2 — "We already use Portkey / LangChain."
- Never attack the gateway. **Concede it and reframe the category.** "Good — keep it. That's your plumbing. I'm selling the decision layer above it."
- The disqualifying question: **"Does your current gateway automatically benchmark DeepSeek against your own production data overnight and switch your traffic by morning — without an engineer approving it?"**
- The answer is no. Every incumbent needs a human to author the routing rule. That gap is the sale.
- Follow-up that closes discovery: *"When did you last change the model behind your highest-volume endpoint? If the answer is more than 90 days, you're paying an inertia tax we can quantify this week."*

### Blocker 3 (anticipate it — Sandeep will ask) — "Why won't OpenAI/Bedrock just do this?"
- Providers have a structural conflict: **they don't get paid to route you off their frontier model.** Neutrality is the product.

---

## 5. Initial ICP — Target Enterprise Accounts (India)

Selection logic: **high token volume × thin unit margin × an existing AI feature already in production.** No greenfield. No pilots-of-curiosity.

| # | Account | Segment | The hook |
|---|---|---|---|
| 1 | **Swiggy / Zomato** | Consumer tech | Route ~80% of trivial tier-1 support queries to Llama-class models; reserve GPT-4-class for complex refunds and escalations. **Zomato already hit cost and latency walls scaling Zia on closed models — this is a documented, live pain.** |
| 2 | **Flipkart / Myntra** | E-commerce | EvalMate auto-QAs millions of AI-generated catalogue descriptions — machine-graded against a merchandising rubric, not sampled by hand. **Sandeep's Flipkart tenure is the warm path in; use it for the meeting, not the pitch.** |
| 3 | **Physics Wallah / upGrad** | EdTech | AI tutors are always-on and token-hungry against a low-ARPU subscription. Cutting inference cost per learner is a **direct defence of contribution margin**. |
| 4 | **Freshworks / Darwinbox** | B2B SaaS | Native AI copilots turn a 80%-gross-margin SaaS into a pass-through of someone else's inference bill. Embed Divyam so **their** margin survives **their** AI roadmap. Strongest expansion account in the list. |
| 5 | **Cred / Groww** | FinTech | Lead with **air-gapped deployment** for local evaluation of sensitive financial document parsing. Here, sovereignty opens the door and cost closes it — in that order. |

**Sequencing:** 2 and 4 first (warm intro + clearest margin math), 1 second (documented pain, hardest procurement), 3 and 5 as parallel long-cycle builds.

---

## 6. Execution — Days 1–30

### Personas to map
- **VP / Head of Platform Engineering** — owns the bill, feels it monthly. *Economic buyer.*
- **AI Infrastructure / ML Platform Lead** — owns the router and the risk. *Technical champion; wins or kills the deal.*
- **CTO** — owns the margin story to the board. *Air cover and signature.*

### Build (week 1–2)
- Account map: **50 accounts → ~200 named contacts**, hand-verified. No purchased lists.
- Stack kept deliberately cheap: domain + inbox warm-up, Apollo/LinkedIn Sales Nav, a single sequencer, CRM. **Zero paid media.**
- Weaponise what already exists: **MakeMyTrip 63% case study**, the *model inertia* and *open-weights moment* posts. Engineers forward technical content; they delete decks.

### Outbound (week 2–4)
- **Lead line:** *"Cut your OpenAI inference bill by 40% this week without breaking your application."*
- Every message carries **one specific, falsifiable technical observation** about their stack. No "quick chat."
- Cadence: 5 touches / 12 days — email → LinkedIn → technical artifact → the disqualifying question above → break-up.
- **Volume target: 40 accounts/week worked, 200 contacts touched.**

### 30-day exit criteria
| Metric | Target |
|---|---|
| Technical discovery calls booked | **15** |
| EvalMate rubric workshops run | **6** |
| Paid single-workload pilots scoped | **3** |
| ICP messaging variants tested | **5** |

### Days 31–90 (stated so the plan has a spine)
- **D31–60:** convert pilots — one workload, measured ₹ saved at constant quality, written success criteria signed before kickoff.
- **D61–90:** **3 closed logos**, one public case study, and a repeatable POC runbook the next AE can execute without me.

---

## 7. What I Need From You

- **Two warm Flipkart-network intros** in week 1. Founder-led warmth beats 500 cold emails.
- **Engineering time-boxed to 3 days per pilot.** POC velocity is our only structural advantage over funded competitors.
- **Permission to publish the cost-arbitrage numbers.** In DevTools, benchmarks are distribution — and they're free.

---

### Sources
- [Divyam.AI — EvalMate](https://divyam.ai/evalmate/) · [Model Router vs Microsoft/NVIDIA](https://divyam.ai/blog/divyam-router-vs-microsoft-nvidia/) · [Model Inertia](https://divyam.ai/blog/model-inertia/) · [Hidden Cost of LLMflation](https://divyam.ai/blog/hidden-cost-of-llmflation/) · [MakeMyTrip case study](https://divyam.ai/customers/makemytrip/)
- [Portkey $15M Series A (Inc42)](https://inc42.com/buzz/portkey-bags-15-mn-to-help-enterprises-manage-ai-spending/) · [Portkey Series A blog](https://portkey.ai/blog/series-a-funding/)
- [Maxim AI $3M seed](https://www.getmaxim.ai/blog/announcing-maxim-ais-general-availability-and-the-3m-funding-round-led-by-elevation-capital/)
- [Simplismart funding (Entrackr)](https://entrackr.com/exclusive/exclusive-gen-ai-startup-simplismart-set-to-raise-9-mn-in-series-b-led-by-dallas-venture-capital-12226753) · [Nvidia-led round report](https://thetechportal.com/2026/05/18/indias-ai-startup-simplismart-could-raise-20-million-in-nvidia-led-funding-round/)
- [Braintrust vs LangSmith (2026)](https://www.morphllm.com/comparisons/braintrust-vs-langsmith) · [LLM observability platforms compared](https://www.marktechpost.com/2026/08/09/top-llm-observability-and-evaluation-platforms-in-2026-langfuse-langsmith-braintrust-arize-and-more-compared/)
- [LLM API pricing 2026](https://www.spheron.network/blog/llm-api-pricing-comparison-gpt-claude-gemini-deepseek-2026/) · [AI Price Index](https://tokencost.app/blog/ai-price-index)
- [Zomato Zia scaling costs (Together AI)](https://www.together.ai/customers/zomato) · [Swiggy support agent (Databricks)](https://www.databricks.com/blog/redefining-customer-support-swiggys-enterprise-scale-ai-agent-built-databricks)
- [DPDP compliance cost breakdown](https://www.consently.in/blog/dpdp-act-compliance-cost-india-2026) · [India data localization: RBI & DPDP](https://www.incorpx.io/blog/data-localization-laws-india-rbi-dpdp)
