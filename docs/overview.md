# Project Wing Overview

Project Wing is a CPA firm operations platform. It is not a single audit application; it is a product family for internal staff workflows and external client collaboration.

## Systems

Project Wing currently has five planned systems:

- **EMP - Engagement Management Platform**: internal engagement execution and working paper management.
- **CMP - Client Management Portal**: client, entity, contact, and engagement master data.
- **TMS - Timesheet Management System**: time entry, approval, budget tracking, and utilization reporting.
- **Intranet Portal**: internal landing page for routing firm staff to the Project Wing systems.
- **IB - Information Bridge**: external PBC upload channel for clients.

## Internal And External Boundaries

EMP, CMP, TMS, and the intranet portal are internal staff systems. They can share employee identity, firm roles, customer records, engagement records, notifications, and internal audit logs.

IB is client-facing. It should have a separate domain, separate authentication flow, limited data exposure, and a narrower API surface. Client users should only see the requests, files, comments, and statuses explicitly exposed to them.

## Shared Concepts

The systems should converge on a small set of shared platform concepts:

- **Firm user**: an internal employee account.
- **Client user**: an external contact with restricted access.
- **Customer**: the client organization or group.
- **Entity**: a legal or reporting entity under a customer.
- **Engagement**: a billable service relationship, such as an audit engagement.
- **Project**: an execution workspace, especially in EMP.
- **Request**: an information request, often exposed through IB.
- **Audit trail**: immutable operational evidence for significant actions.

## Product Direction

The near-term documentation goal is to make the platform shape clear before expanding implementation. New features should be described against the system they belong to, the shared data they consume, and the deployment boundary they require.

## Frontend UI Stack

All product frontends must follow `docs/ui-stack-guardrails.md`. The enforced stack is shared across EMP, CMP, TMS, IB, and the intranet portal so UI implementation does not drift by system.
