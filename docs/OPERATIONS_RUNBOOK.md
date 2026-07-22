# Ankur Operations Runbook

> **Version:** 1.0.0  
> **Audience:** Team Hotasha

## 1. Required environments

### Local

```env
GEMINI_API_KEY=<private>
ANKUR_LIVE_AI_ENABLED=true
ANKUR_SAMPLE_MODE_ENABLED=true
GEMMA_PRIMARY_MODEL=gemma-4-26b-a4b-it
GEMMA_ESCALATION_MODEL=gemma-4-31b-it
GEMMA_NATIVE_STRUCTURED_OUTPUT=auto
AI_REQUEST_TIMEOUT_MS=90000
AI_MAX_NETWORK_RETRIES=1
AI_MAX_SCHEMA_REPAIRS=1
```

### Production

Configure the same non-secret values and the private key in Vercel environment settings. Never upload `.env.local`.

## 2. Local startup checklist

1. Install exact lockfile dependencies.
2. Copy `.env.example` to `.env.local`.
3. Add the private key.
4. Run environment validation.
5. Run `npm run dev`.
6. Open `/api/health`.
7. Open `/api/runtime-status`.
8. Run the provider spike script explicitly.

## 3. Pre-deployment checklist

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Then:

- scan for secrets;
- verify `.env*` ignore rules;
- verify provider code is server-only;
- inspect generated client bundle for key fragments;
- verify sample assets contain no private/copyrighted content;
- review environment variables by target environment.

## 4. Production smoke test

In an incognito browser:

1. Open landing page.
2. Confirm no login is required.
3. Run sample golden path.
4. Check Bengali typography.
5. Check mobile viewport.
6. Check `/api/health`.
7. Run one short live operation.
8. Confirm evidence links.
9. Confirm no raw source appears in browser console or network errors.
10. Repeat complete sample flow three times.

## 5. Live-mode readiness indicators

The UI must distinguish:

- live Gemma ready;
- live Gemma degraded;
- live generation disabled;
- sample mode active.

Never present sample output as newly generated.

## 6. Kill switch

Set:

```env
ANKUR_LIVE_AI_ENABLED=false
```

Redeploy or apply environment change according to platform behavior. The application should continue serving landing pages and labelled sample mode.

Use the kill switch for:

- leaked key;
- uncontrolled abuse;
- exhausted quota;
- repeated invalid model output;
- provider outage causing unusable UX.

## 7. Provider failure response

### 401/403

- Verify key configuration and restrictions.
- Do not retry automatically.
- Disable live mode if unresolved.

### 429

- Respect retry guidance.
- One application retry maximum.
- Check active project limits in Google AI Studio.
- Offer manual retry or sample mode.

### Timeout/5xx

- One bounded retry.
- Preserve stable browser state.
- Avoid repeated parallel calls.

### Invalid output

- One schema repair.
- One evidence repair if needed.
- Reject unresolved artifact and show a recoverable message.

## 8. Key rotation

1. Create/retrieve a replacement restricted/auth key.
2. Update local and production secrets.
3. redeploy;
4. run provider and production smoke tests;
5. revoke the old key;
6. verify no old key remains in local files or history.

## 9. Rollback

- Keep the last known-good deployment.
- Roll back immediately when a release breaks the golden path, evidence validation, or key security.
- Do not hot-fix production without reproducing locally unless submission availability is at immediate risk.
- After rollback, record the failed deployment and affected commit.

## 10. Submission-day monitoring

- Keep one team member responsible for public links and runtime.
- Keep provider quota view available.
- Avoid unnecessary live-generation testing after final verification.
- Preserve the recorded video and sample mode as independent proof.
- Verify every link from an unauthenticated/incognito session.
