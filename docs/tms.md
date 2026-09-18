# TMS - Timesheet Management System

TMS is the internal system for time capture, approval, and reporting.

## Purpose

TMS helps the firm understand time spent by staff, engagement, service line, and period. It should connect operational work to budgets and utilization reporting.

## Core Capabilities

- Daily or weekly time entry
- Time categories and task codes
- Engagement and project lookup
- Submission and approval workflow
- Budget versus actual reporting
- Staff utilization views
- Locking or close periods
- Export for payroll, billing, or management reporting

## Relationship To Other Systems

- CMP supplies engagement codes and client metadata.
- EMP supplies audit project context for audit-related time entries.
- IB normally does not consume TMS data.

## Boundary

TMS is an internal system. It should share master data with CMP and EMP but keep approval, utilization, and reporting rules in its own domain.
