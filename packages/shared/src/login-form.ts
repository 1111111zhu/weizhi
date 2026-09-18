export type LoginFormValues = {
  email: string;
  password: string;
};

type LoginFormSource = {
  elements: {
    namedItem: (name: string) => unknown;
  };
};

export function readLoginFormValues(
  form: LoginFormSource,
  fallback: LoginFormValues
): LoginFormValues {
  return {
    email: readControlValue(form, "email", fallback.email),
    password: readControlValue(form, "password", fallback.password),
  };
}

function readControlValue(
  form: LoginFormSource,
  name: string,
  fallback: string
) {
  const control = form.elements.namedItem(name);
  if (!control || typeof control !== "object" || !("value" in control)) {
    return fallback;
  }
  const { value } = control as { value?: unknown };
  return typeof value === "string" ? value : fallback;
}
