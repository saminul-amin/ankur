# Ankur Delivery Plan

> **Version:** 1.0.0  
> **Timezone:** Asia/Dhaka  
> **Internal feature freeze:** 24 July 2026, 16:00  
> **Internal submission target:** 24 July 2026, 22:00

## 1. Delivery philosophy

Build and verify one complete vertical slice before broadening question types or polishing secondary screens.

```text
Architecture contract
→ provider spike
→ thin P0 vertical slice
→ production deployment
→ complete P0
→ evaluation
→ presentation assets
```

## 2. Gate 0 — Architecture ready

Deliverables:

- this architecture pack;
- final SSOT decision update;
- golden Bengali fixture outline;
- API key available privately.

Exit criteria:

- no unresolved architecture contradiction;
- local/self-hosted model references removed from MVP instructions;
- all team members understand public source-data disclosure.

## 3. Gate 1 — Provider spike

Deliverables:

- server-only Google GenAI client;
- text and image calls to Gemma 4;
- schema proof;
- typed error mapping;
- redacted results report.

Exit criteria:

- Bengali text and image requests work;
- primary model is reachable;
- structured output either works natively or has a proven JSON/Zod fallback;
- measured latency and limitations recorded;
- no secret in client bundle.

## 4. Gate 2 — Thin vertical slice

Scope:

```text
pasted text or one digital PDF page
→ confirm source
→ preparation map
→ one MCQ
→ deterministic result
```

Exit criteria:

- production deployment works;
- source evidence is validated;
- sample mode works;
- quality commands pass.

## 5. Gate 3 — Complete P0

Add:

- scanned-page transcription;
- one short written question;
- criterion grading;
- concept diagnosis;
- revision and retry;
- browser persistence;
- recovery states.

Exit criteria:

- complete golden path works locally and in production;
- all critical/high defects resolved;
- no P1 work started before this gate.

## 6. Gate 4 — Evaluation and polish

- run internal evaluation;
- fix severe grounding or answer-key defects;
- verify Bengali typography and mobile flow;
- finalize public technical docs;
- capture screenshots and architecture diagram;
- record demo.

## 7. Feature freeze

After 24 July 16:00:

Allowed:

- critical bug fixes;
- broken-link fixes;
- copy corrections;
- presentation improvements;
- honest limitation updates.

Not allowed:

- new question types;
- new persistence system;
- architecture change;
- model-provider change;
- database introduction;
- broad UI redesign.

## 8. Work ownership

### Technical lead

- architecture, implementation, model integration, deployment, evaluation tooling, secret and build verification.

### Team leader

- golden source material, Bengali quality review, question/grading human labels, demo narrative, submission checklist, final links.

### Shared

- live golden-path testing, claim approval, demo review, official rule verification.

## 9. Stop-the-line criteria

Pause optional work immediately when:

- production live flow is unavailable;
- provider quota is uncertain;
- source evidence validation fails;
- build or typecheck fails;
- assessment state can be lost;
- submission links are not publicly accessible.
