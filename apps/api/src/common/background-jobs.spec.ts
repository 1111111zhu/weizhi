import {
  backgroundJobsEnabled,
  backgroundScheduleOptions,
} from "./background-jobs";

describe(backgroundJobsEnabled, () => {
  it("enables background jobs by default", () => {
    expect(backgroundJobsEnabled({})).toBeTruthy();
  });

  it("recognizes an explicit false value case-insensitively", () => {
    expect(
      backgroundJobsEnabled({
        PROJECTWING_BACKGROUND_JOBS_ENABLED: "  FaLsE  ",
      })
    ).toBeFalsy();
  });

  it("disables every Nest scheduler type with the maintenance switch", () => {
    expect(
      backgroundScheduleOptions({
        PROJECTWING_BACKGROUND_JOBS_ENABLED: "false",
      })
    ).toStrictEqual({
      cronJobs: false,
      intervals: false,
      timeouts: false,
    });
  });
});
