# CMP - Client Management Portal

CMP is the system of record for client and engagement master data, and the summary layer for engagement-level operating data.

## Purpose

CMP keeps firm-side client information consistent across the audit documentation system, TMS, and IB. It should reduce duplicate setup, make engagement ownership visible to internal teams, and provide an Individual Engagement Summary that combines engagement metadata, time cost, billing status, and archive dates.

## Core Capabilities

- Client records created after NCA approval
- Client codes
- Entity and contact records
- Engagement records created under a client after NEA approval
- Engagement codes
- Service type and engagement status tracking
- Partner, manager, and staff ownership
- Relationship history and notes
- Client and engagement search
- Individual Engagement Summary
- Billing-status fields for summary reporting

## Relationship To Other Systems

- The audit documentation system uses CMP engagement data when creating audit projects, including an active `Engagement Code` dropdown.
- Project members complete independence declarations in the audit system for the selected engagement/project.
- TMS uses CMP engagement data for time entry. A staff member can save or submit time only when the work date is on or after that member's independence declaration date for the engagement.
- IB uses CMP contact data when granting external access to PBC requests.
- CMP summarizes TMS hours as engagement cost data. Expense details and full billing workflow can be added later.

## Boundary

CMP is an internal system. External client users should not access CMP directly; IB should expose only the client-facing subset needed for request submission and communication. TMS is a separate same-level internal entry point, not a CMP sub-page, although CMP consumes TMS data for engagement summaries.
