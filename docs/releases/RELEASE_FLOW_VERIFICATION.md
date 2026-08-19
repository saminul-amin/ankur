# Ankur release flow verification

- Origin: `http://127.0.0.1:3300`
- Home: HTTP 200
- Health: HTTP 200
- Runtime status: HTTP 200
- Live AI enabled: yes; provider configured: yes
- Primary model: `gemma-4-26b-a4b-it`
- Build ID: `local`
- Live language flows passed: 3/3
- Flows blocked by provider availability after 3 attempts: 0
- Flows that produced an invalid generated artifact: 0
- Controlled-failure path: passed — HTTP 400 with code VALIDATION_FAILED; provider or credential leakage: no.

| Flow | Language | Outcome | Analysis (ms) | Assessment (ms) | Written (ms) | Written status | Marks | Grounding failures | Quote failures | Totals reconcile |
|---|---|---|---:|---:|---:|---|---:|---:|---:|---|
| english-pasted-text | en | passed | 4870 | 31404 | 2339 | correct | 5/5 | 0 | 0 | yes |
| bengali-pasted-text | bn | passed | 4269 | 5116 | 2877 | correct | 5/5 | 0 | 0 | yes |
| mixed-pasted-text | mixed | passed | 4183 | 25903 | 2504 | partially_correct | 2/5 | 0 | 0 | yes |

## Detail

- `english-pasted-text`: Analysis, assessment, and written grading all validated.
- `bengali-pasted-text`: Analysis, assessment, and written grading all validated.
- `mixed-pasted-text`: Analysis, assessment, and written grading all validated.

An `invalid_output` outcome means the application refused to persist an invalid
generated artifact and returned a safe typed error. That is correct product
behaviour, not a deployment defect.

A `provider_unavailable` outcome means Google's hosted API was unreachable,
timed out, rate-limited, or out of quota for every attempt. It measures the
external dependency, not Ankur.

No credential, prompt, provider response body, source text, reference answer,
student answer, generated question, or feedback is recorded in this report.
