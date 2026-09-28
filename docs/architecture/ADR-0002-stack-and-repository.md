# 0002: React, Fastify and monorepo

Status: APPROVED by product owner, 2026-09-28 (UTC).
Decision IDs: ARCH-D002, ARCH-D003, ARCH-D005.
Selected option: A.

## Context

A separately served client needs a typed contract with the backend. This is ProjectX design, not an inference about the reference application.

## Decision

Build the web client with React and TypeScript; use Node.js LTS, Fastify and TypeScript for the backend; maintain one monorepo. Workspace packages may hold shared infrastructure and generated contracts, but domain business rules remain within domain modules.

## Consequences and verification

Independent deployments require contract/version discipline; generic shared packages must not become an unowned domain layer.

Verify in the applicable foundation task with isolated data and negative authorization/tenant tests. This ADR specifies architecture only; it adds no application implementation.
