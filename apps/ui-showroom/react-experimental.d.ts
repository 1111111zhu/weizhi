import "react";

declare module "react" {
  export const ViewTransition: React.ComponentType<{
    name?: string;
    children?: React.ReactNode;
    types?: string[];
    enter?: Record<string, string>;
    exit?: Record<string, string>;
    default?: string;
  }>;
  export function addTransitionType(type: string): void;
}
