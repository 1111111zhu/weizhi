import { workspaceMemberUserSelect } from "./workspace-select";

describe("workspace member user selection", () => {
  it("does not expose password hashes through workspace member payloads", () => {
    expect(Object.keys(workspaceMemberUserSelect)).toStrictEqual([
      "id",
      "name",
      "email",
      "globalRole",
      "status",
    ]);
    expect("passwordHash" in workspaceMemberUserSelect).toBeFalsy();
  });
});
