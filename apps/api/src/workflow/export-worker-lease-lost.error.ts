export class ExportWorkerLeaseLostError extends Error {
  constructor() {
    super("The export job is now owned by another worker.");
    this.name = "ExportWorkerLeaseLostError";
  }
}
