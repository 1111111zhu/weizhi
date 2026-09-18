import { execFileSync } from "node:child_process";
import pathModule from "node:path";

describe("project workflow numbering migration", () => {
  it("renumbers stored directories, files, and recycle-bin references", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          pathModule.resolve(
            process.cwd(),
            "scripts/verify-workflow-numbering-migration.mjs"
          ),
        ],
        {
          cwd: process.cwd(),
          encoding: "utf-8",
          stdio: "pipe",
        }
      )
    ).not.toThrow(/./);
  }, 30_000);
});
