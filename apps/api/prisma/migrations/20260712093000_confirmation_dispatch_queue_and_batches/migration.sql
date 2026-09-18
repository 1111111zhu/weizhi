-- Queue returns preserve the immutable artifact while removing it from active dispatch use.
ALTER TYPE "ConfirmationArtifactDisposition" ADD VALUE 'RETURNED';

-- A mixed batch is operationally complete but requires follow-up for only failed items.
ALTER TYPE "ConfirmationDispatchBatchStatus" ADD VALUE 'PARTIAL_FAILURE';

-- Batch execution records the creation of a dispatch attempt before physical custody begins.
ALTER TYPE "ConfirmationDispatchEventType" ADD VALUE 'CREATED';
