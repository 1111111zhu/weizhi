import { ArchiveReminderService } from "./archive-reminder.service";

describe(ArchiveReminderService, () => {
  it("does not query or send reminders while background jobs are disabled", async () => {
    vi.stubEnv("PROJECTWING_BACKGROUND_JOBS_ENABLED", "false");
    try {
      const findMany = vi.fn();
      const createCollaborationMessage = vi.fn();
      const service = new ArchiveReminderService(
        { project: { findMany } } as never,
        { createCollaborationMessage } as never
      );

      await service.sendArchiveDeadlineReminders();

      expect(findMany).not.toHaveBeenCalled();
      expect(createCollaborationMessage).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
