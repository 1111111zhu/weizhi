import { cn } from "@/lib/utils";

const EXPORTED_LOGO_FOREGROUNDS = {
  dark: "rgb(250 250 250)",
  light: "rgb(9 9 11)",
} as const;

type LogoMarkProps = React.SVGProps<SVGSVGElement>;
type ExportedLogoTheme = keyof typeof EXPORTED_LOGO_FOREGROUNDS;

export const LogoMark = ({ className, ...props }: LogoMarkProps) => (
  <svg
    aria-hidden="true"
    className={cn("size-5", className)}
    viewBox="0 0 160 160"
    {...props}
  >
    <path
      d="M142.88 142.73c.42-.61-.45-2.54-.88-3.5-12.65-28.5-30.73-54.07-53-75.31-1.48-1.38-2.59-1.91-4.36-1.91-4.64-.01-17.34-.02-20.98 0-.52.01-1 .02-1.33.31-.29.34-.29.82-.31 1.33-.02 3.65-.02 16.35 0 20.99 0 1.83.57 2.94 2.03 4.49 21.27 22.26 46.85 40.33 75.37 52.96.96.44 2.86 1.3 3.43.7l.05-.06Z"
      fill="currentColor"
    />
    <path
      d="M143 107c-9.15 0-18.3 3.46-25.32 10.41-7.11 7.04-10.67 16.31-10.67 25.58 9.15 0 18.3-3.46 25.32-10.41 7.11-7.04 10.67-16.31 10.67-25.58Z"
      fill="currentColor"
    />
    <path
      d="M17 17v126h18V35h108V17H17Zm45 45v81h27V89h54V62H62Z"
      fill="currentColor"
    />
  </svg>
);

export const getLogoMarkSVG = (theme: ExportedLogoTheme = "light") => {
  const foreground = EXPORTED_LOGO_FOREGROUNDS[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><path fill="${foreground}" d="M142.88 142.73c.42-.61-.45-2.54-.88-3.5-12.65-28.5-30.73-54.07-53-75.31-1.48-1.38-2.59-1.91-4.36-1.91-4.64-.01-17.34-.02-20.98 0-.52.01-1 .02-1.33.31-.29.34-.29.82-.31 1.33-.02 3.65-.02 16.35 0 20.99 0 1.83.57 2.94 2.03 4.49 21.27 22.26 46.85 40.33 75.37 52.96.96.44 2.86 1.3 3.43.7l.05-.06Z"/><path fill="${foreground}" d="M143 107c-9.15 0-18.3 3.46-25.32 10.41-7.11 7.04-10.67 16.31-10.67 25.58 9.15 0 18.3-3.46 25.32-10.41 7.11-7.04 10.67-16.31 10.67-25.58Z"/><path fill="${foreground}" d="M17 17v126h18V35h108V17H17Zm45 45v81h27V89h54V62H62Z"/></svg>`;
};
