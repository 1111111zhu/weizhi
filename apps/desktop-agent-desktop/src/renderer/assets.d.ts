declare module "*.css";

declare const __PROJECT_WING_DESKTOP_BUILD_LABEL__: string;

declare module "*.png" {
  const source: string;
  export default source;
}

declare module "*.svg" {
  const source: string;
  export default source;
}
