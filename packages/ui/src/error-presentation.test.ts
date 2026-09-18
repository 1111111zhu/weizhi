import { describe, expect, it } from "vitest";

import { getProjectWingErrorPresentation } from "./error-presentation";

describe(getProjectWingErrorPresentation, () => {
  it("keeps a safe business reason returned by the service", () => {
    const presentation = getProjectWingErrorPresentation({
      code: "BAD_REQUEST",
      message: "This workpaper has no file to sign.",
      requestId: "request-smartform-1",
    });

    expect(presentation).toStrictEqual({
      title: "Action unavailable",
      description:
        "This workpaper has no file to sign. Reference: request-smartform-1",
      code: "BAD_REQUEST",
      requestId: "request-smartform-1",
    });
  });

  it("gives SmartForm validation a specific title and reason", () => {
    const presentation = getProjectWingErrorPresentation({
      code: "SMART_FORM_INCOMPLETE",
      message: "Complete section A before preparing this SmartForm.",
    });

    expect(presentation).toMatchObject({
      title: "SmartForm incomplete",
      description: "Complete section A before preparing this SmartForm.",
    });
  });

  it("explains a project template initialization failure without exposing infrastructure details", () => {
    const presentation = getProjectWingErrorPresentation({
      code: "PROJECT_TEMPLATE_INITIALIZATION_FAILED",
      message: "NoSuchKey: /private/project-template-source.docx",
    });

    expect(presentation).toStrictEqual({
      title: "Project template unavailable",
      description:
        "The project template could not be initialized. Ask an administrator to verify its files, then try again.",
      code: "PROJECT_TEMPLATE_INITIALIZATION_FAILED",
      requestId: null,
    });
  });

  it("does not expose internal server details", () => {
    const presentation = getProjectWingErrorPresentation({
      code: "INTERNAL_SERVER_ERROR",
      message: "Prisma failed at services/signoff.ts:41:9",
      requestId: "request-server-1",
    });

    expect(presentation.title).toBe("Server error");
    expect(presentation.description).toBe(
      "The server could not complete the request. Please try again. Reference: request-server-1"
    );
    expect(presentation.description).not.toContain("Prisma");
  });

  it("recognizes browser network failures", () => {
    const presentation = getProjectWingErrorPresentation(
      new TypeError("Failed to fetch")
    );

    expect(presentation).toMatchObject({
      title: "Connection problem",
      description:
        "Network connection failed. Check your connection and try again.",
      code: "NETWORK_FAILED",
    });
  });

  it("does not repeat a generic service message", () => {
    const presentation = getProjectWingErrorPresentation({
      code: "REQUEST_FAILED",
      message: "Request failed",
    });

    expect(presentation).toMatchObject({
      title: "Action could not be completed",
      description: "Something went wrong. Please try again.",
    });
  });
});
