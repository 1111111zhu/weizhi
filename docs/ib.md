# IB - Information Bridge

IB is the external client-facing PBC upload channel.

## Purpose

IB gives clients a controlled way to view information requests, upload files, leave comments, and track submission status. It should replace ad hoc email or chat-based PBC collection for client materials.

## Core Capabilities

- Client access by secure invitation or limited external account
- PBC request list
- Request status, deadline, and ownership display
- File upload and replacement
- Client comments and auditor responses
- Submission confirmation
- Auditor accept, reject, or request-more-information actions
- Client-facing notification flow
- Client access audit trail

## Relationship To Other Systems

- EMP creates or approves the request list and consumes submitted materials.
- CMP supplies client contact and entity data for access control.
- TMS is not part of the normal IB workflow.

## Boundary

IB is externally exposed and should be treated as a separate product surface. Even if it lives in the same monorepo, it should have a distinct domain, deployment configuration, authentication flow, API surface, rate limiting, and logging policy.

IB must not expose internal EMP working papers, staff-only comments, internal review notes, or unrestricted project records.
