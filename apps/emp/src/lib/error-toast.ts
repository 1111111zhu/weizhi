import {
  getProjectWingErrorPresentation,
  isProjectWingAbortError,
  isProjectWingNetworkError,
  PROJECT_WING_DEFAULT_ERROR_MESSAGE,
  PROJECT_WING_DEFAULT_ERROR_TITLE,
  projectWingToast as sonnerToast,
  sanitizeProjectWingErrorDescription,
} from "@project-wing/ui";

const DEFAULT_ERROR_MESSAGE = PROJECT_WING_DEFAULT_ERROR_MESSAGE;
const DEFAULT_ERROR_TITLE = PROJECT_WING_DEFAULT_ERROR_TITLE;

export function isAbortError(error: unknown) {
  return isProjectWingAbortError(error);
}

export function isNetworkError(error: unknown) {
  return isProjectWingNetworkError(error);
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE
) {
  return getProjectWingErrorPresentation(error, fallback).description;
}

export function showErrorToast(
  error: unknown,
  title = DEFAULT_ERROR_TITLE,
  fallback = DEFAULT_ERROR_MESSAGE
) {
  if (isAbortError(error)) {
    return;
  }
  const presentation = getProjectWingErrorPresentation(error, fallback);
  const resolvedTitle =
    title === DEFAULT_ERROR_TITLE ? presentation.title : title;
  sonnerToast.error(resolvedTitle, {
    description: presentation.description,
    duration: 5000,
    id: `request-error:${presentation.requestId ?? presentation.code ?? "unknown"}`,
  });
}

export function sanitizeErrorDescription(
  description: string | undefined,
  fallback = DEFAULT_ERROR_MESSAGE
) {
  return sanitizeProjectWingErrorDescription(description, fallback);
}

export { DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_TITLE };
