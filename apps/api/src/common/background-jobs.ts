export const BACKGROUND_JOBS_ENABLED_ENV =
  "PROJECTWING_BACKGROUND_JOBS_ENABLED";

export function backgroundJobsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env[BACKGROUND_JOBS_ENABLED_ENV]?.trim().toLowerCase() !== "false";
}

export function backgroundScheduleOptions(
  env: NodeJS.ProcessEnv = process.env
) {
  const enabled = backgroundJobsEnabled(env);
  return {
    cronJobs: enabled,
    intervals: enabled,
    timeouts: enabled,
  };
}
