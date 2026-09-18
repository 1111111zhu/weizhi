# EMP - Engagement Management Platform

EMP is the internal engagement execution platform for firm staff.

## Purpose

EMP manages engagement projects from setup through execution and archive. It should help teams organize engagement work, manage working papers, request client information, review evidence, and preserve audit trails.

## Core Capabilities

- Engagement project setup
- Project team and role management
- Working paper directory and file management
- File upload, replacement, versioning, and download
- Review notes and issue tracking
- Signoff and review workflows
- PBC request preparation for client-facing collection through IB
- Archive and retention workflows
- Project-level audit trail

## UI Stack

EMP UI work must follow `docs/ui-stack-guardrails.md`. The required stack is Next.js, TypeScript, shadcn/ui wrappers, Base UI through approved wrappers, Tailwind CSS v4 semantic tokens, `lucide-react`, React Hook Form, and Zod. Radix UI is prohibited; when a primitive is needed, prefer Base UI through an approved wrapper.

## Relationship To Other Systems

- CMP supplies clients, entities, contacts, and engagement metadata.
- TMS consumes EMP project or engagement data for time entry and budget tracking.
- IB exposes selected EMP PBC requests and uploaded client materials to external users without exposing internal working papers.

## Boundary

EMP is an internal system. It should not directly expose internal project workspaces, working papers, or audit logs to external client users.
