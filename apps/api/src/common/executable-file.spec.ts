import { constants } from "node:fs";
import { access, chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { ensureExecutableFile } from "./executable-file";

const maybeDescribe = process.platform === "win32" ? describe.skip : describe;

maybeDescribe("ensureExecutableFile", () => {
  it("adds execute permission to a bundled binary when possible", async () => {
    const tempRoot = await mkdtemp(
      pathModule.join(tmpdir(), "projectwing-exec-test-")
    );
    const executablePath = pathModule.join(tempRoot, "tool");
    await writeFile(executablePath, "#!/bin/sh\nexit 0\n");
    await chmod(executablePath, 0o644);

    const preparedPath = await ensureExecutableFile(executablePath);

    expect(preparedPath).toBe(executablePath);
    await expect(access(preparedPath, constants.X_OK)).resolves.toBeUndefined();
  });
});
