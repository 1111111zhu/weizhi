import type { Metadata } from "next";

import { LINK } from "@/constants/links";
import { ROUTES, withShowroomBasePath } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { absoluteUrl } from "@/lib/utils";

interface CreatePageMetadataOptions {
  description?: string;
  noIndex?: boolean;
  ogDescription?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogTitle?: string;
  ogType?: "article" | "website";
  path: string;
  title: string;
}

const buildPageAlternates = (
  canonical: string,
  markdownAlternate?: string
): Metadata["alternates"] => ({
  canonical: absoluteUrl(canonical),
  ...(markdownAlternate && {
    types: {
      "text/markdown": absoluteUrl(markdownAlternate),
    },
  }),
});

const buildPageOpenGraph = ({
  description,
  image,
  imageAlt,
  title,
  type,
  canonical,
}: {
  description?: string;
  image: string;
  imageAlt: string;
  title: string;
  type: "article" | "website";
  canonical: string;
}): NonNullable<Metadata["openGraph"]> => ({
  description,
  images: [{ alt: imageAlt, height: 630, url: image, width: 1200 }],
  locale: "en_US",
  siteName: SITE.NAME,
  title,
  type,
  url: absoluteUrl(canonical),
});

const buildPageTwitter = ({
  description,
  image,
  title,
}: {
  description?: string;
  image: string;
  title: string;
}): NonNullable<Metadata["twitter"]> => ({
  card: "summary_large_image",
  creator: SITE.AUTHOR.TWITTER,
  description,
  images: [image],
  site: SITE.AUTHOR.TWITTER,
  title,
});

const buildNoIndexMetadata = (noIndex: boolean): Metadata =>
  noIndex ? { robots: { follow: false, index: false } } : {};

export const createPageMetadata = ({
  description,
  noIndex = false,
  ogDescription,
  ogImage,
  ogImageAlt,
  ogTitle,
  ogType = "website",
  path,
  title,
}: CreatePageMetadataOptions): Metadata => {
  const canonical = path.startsWith(ROUTES.HOME)
    ? path
    : `${ROUTES.HOME}${path}`;
  const markdownAlternate =
    canonical === ROUTES.DOCS || canonical.startsWith(`${ROUTES.DOCS}/`)
      ? `${canonical}.md`
      : undefined;
  const resolvedOgImage = absoluteUrl(
    ogImage ?? `${ROUTES.OG}${canonical === ROUTES.HOME ? "" : canonical}`
  );
  const resolvedTitle = ogTitle ?? title;

  return {
    alternates: buildPageAlternates(canonical, markdownAlternate),
    description,
    openGraph: buildPageOpenGraph({
      canonical,
      description: ogDescription ?? description,
      image: resolvedOgImage,
      imageAlt: ogImageAlt ?? resolvedTitle,
      title: resolvedTitle,
      type: ogType,
    }),
    title,
    twitter: buildPageTwitter({
      description: ogDescription ?? description,
      image: resolvedOgImage,
      title: resolvedTitle,
    }),
    ...buildNoIndexMetadata(noIndex),
  };
};

export const baseMetadata: Metadata = {
  alternates: {
    canonical: absoluteUrl(ROUTES.HOME),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE.NAME,
  },
  applicationName: SITE.NAME,
  authors: [{ name: SITE.AUTHOR.NAME, url: LINK.PORTFOLIO }],
  category: "technology",
  creator: SITE.AUTHOR.NAME,
  description: SITE.DESCRIPTION.LONG,
  icons: {
    apple: {
      sizes: "180x180",
      type: "image/png",
      url: withShowroomBasePath("/apple-touch-icon.png"),
    },
    icon: [
      {
        sizes: "32x32",
        url: withShowroomBasePath("/favicon.ico"),
      },
      {
        sizes: "96x96",
        type: "image/png",
        url: withShowroomBasePath("/favicon-96x96.png"),
      },
      {
        media: "(prefers-color-scheme: light)",
        sizes: "any",
        type: "image/svg+xml",
        url: withShowroomBasePath("/favicon.svg"),
      },
      {
        media: "(prefers-color-scheme: dark)",
        sizes: "any",
        type: "image/svg+xml",
        url: withShowroomBasePath("/favicon-dark.svg"),
      },
    ],
    shortcut: withShowroomBasePath("/favicon-16x16.png"),
  },
  keywords: [...SITE.KEYWORDS],
  manifest: withShowroomBasePath(ROUTES.MANIFEST),
  metadataBase: new URL(SITE.URL),
  openGraph: {
    description: SITE.DESCRIPTION.LONG,
    images: [
      {
        alt: SITE.NAME,
        height: 630,
        url: SITE.OG_IMAGE,
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: SITE.NAME,
    title: SITE.NAME,
    type: "website",
    url: SITE.URL,
  },
  publisher: SITE.AUTHOR.NAME,
  title: {
    default: `${SITE.NAME} - ${SITE.DESCRIPTION.SHORT}`,
    template: `%s | ${SITE.NAME}`,
  },
  twitter: {
    card: "summary_large_image",
    creator: SITE.AUTHOR.TWITTER,
    description: SITE.DESCRIPTION.LONG,
    images: [SITE.OG_IMAGE],
    site: SITE.AUTHOR.TWITTER,
    title: SITE.NAME,
  },
};
