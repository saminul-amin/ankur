# ADR-0001: Use a Next.js Modular Monolith

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

Ankur needs a public UI, narrow server APIs, server-only model access, and no production database or background workers during the hackathon.

## Decision

Use one Next.js App Router deployment. React provides the UI; Node.js Route Handlers provide the backend-for-frontend. Organize code into presentation, application, domain, and infrastructure modules.

## Alternatives considered

- Separate Next.js and FastAPI services.
- Separate Next.js and NestJS services.
- Client-only application.

## Consequences

Positive:

- one repository and deployment;
- shared TypeScript contracts;
- server-only provider access;
- lower integration risk.

Negative:

- serverless duration and payload constraints;
- backend independently cannot scale or deploy yet.

## Revisit when

Accounts, durable server data, worker queues, long-document jobs, mobile clients, or independent backend scaling become requirements.
