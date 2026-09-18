-- Add the dedicated HR global role used by the TMS overview.
ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS 'HR' BEFORE 'CONFIRMATION_OFFICER';
