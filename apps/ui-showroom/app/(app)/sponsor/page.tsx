import { ExternalLink, Heart, Plus, Star } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { ExternalLinkButton } from "@/components/external-link-button";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LINK } from "@/constants/links";
import { ROUTES } from "@/constants/routes";
import { getStargazers } from "@/lib/github";
import { tiers } from "@/lib/sponsors";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  description:
    "Support the ProjectWing UI Showroom and learn how registry contributions are reviewed.",
  path: ROUTES.SPONSOR,
  title: "Sponsor",
});

type Tier = (typeof tiers)[number];

type TierStyles = {
  band: string;
  marker: string;
  title: string;
  slot: string;
  emptySlot: string;
  plus: string;
};

const TIER_STYLES: Record<string, TierStyles> = {
  Gold: {
    band: "bg-linear-to-br from-amber-600 via-amber-200 to-yellow-600 shadow-inner",
    marker:
      "border border-black/15 bg-linear-to-br from-amber-300 via-white/50 to-amber-700 shadow-inner",
    title: "text-amber-950",
    slot: "border-amber-600/25 bg-amber-600/8",
    emptySlot: "border-amber-600/25",
    plus: "text-amber-700",
  },
  Silver: {
    band: "bg-linear-to-br from-zinc-400 via-zinc-200 to-zinc-500 shadow-inner",
    marker:
      "border border-black/15 bg-linear-to-br from-zinc-300 via-white/50 to-zinc-600 shadow-inner",
    title: "text-zinc-800",
    slot: "border-zinc-500/25 bg-zinc-500/8",
    emptySlot: "border-zinc-500/25",
    plus: "text-zinc-600",
  },
  Bronze: {
    band: "bg-linear-to-br from-orange-700 via-orange-300 to-orange-800 shadow-inner",
    marker:
      "border border-black/15 bg-linear-to-br from-orange-300 via-white/50 to-orange-800 shadow-inner",
    title: "text-orange-950",
    slot: "border-orange-700/25 bg-orange-700/8",
    emptySlot: "border-orange-700/25",
    plus: "text-orange-800",
  },
};

const getTierStyles = (name: string) => TIER_STYLES[name] ?? TIER_STYLES.Gold;

const getGridClass = (slots: number) => {
  const columns = Math.min(Math.max(slots, 1), 4);
  const classes = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

  return `${classes[columns - 1]} max-lg:grid-cols-2 max-sm:grid-cols-1`;
};

const TierHeader = ({ name, styles }: { name: string; styles: TierStyles }) => (
  <div
    className={`relative flex items-center justify-center rounded-md px-8 py-2.5 ${styles.band}`}
  >
    {["left-2.5", "right-2.5"].map((position) => (
      <span
        key={position}
        className={`absolute top-1/2 size-2 -translate-y-1/2 rounded-full ${position} ${styles.marker}`}
      />
    ))}
    <h3
      className={`text-xs font-extrabold tracking-[0.2em] uppercase ${styles.title}`}
    >
      {name}
    </h3>
  </div>
);

const SponsorSlot = ({
  sponsor,
  styles,
}: {
  sponsor: Tier["sponsors"][number];
  styles: TierStyles;
}) => (
  <a
    href={sponsor.href}
    target="_blank"
    rel="noopener noreferrer"
    className={`group flex items-center justify-center rounded-md border p-6 transition-all hover:scale-[1.02] ${styles.slot}`}
  >
    {sponsor.logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sponsor.logo}
        alt={sponsor.name}
        className="h-8 w-auto opacity-60 transition-opacity group-hover:opacity-100"
      />
    ) : (
      <span className="text-sm font-medium text-foreground">
        {sponsor.name}
      </span>
    )}
  </a>
);

const EmptySponsorSlot = ({
  index,
  tierName,
  styles,
}: {
  index: number;
  tierName: string;
  styles: TierStyles;
}) => (
  <a
    href={LINK.SPONSOR}
    target="_blank"
    rel="noopener noreferrer"
    className={`flex items-center justify-center rounded-md border border-dashed p-8 transition-all hover:scale-[1.02] ${styles.emptySlot}`}
    key={`empty-${tierName}-${index}`}
  >
    <Plus className={`size-5 opacity-50 ${styles.plus}`} />
  </a>
);

const TierGrid = ({ tier, styles }: { tier: Tier; styles: TierStyles }) => {
  const emptySlots = Math.max(tier.slots - tier.sponsors.length, 0);

  return (
    <div className={`grid gap-2 ${getGridClass(tier.slots)}`}>
      {tier.sponsors.map((sponsor) => (
        <SponsorSlot key={sponsor.name} sponsor={sponsor} styles={styles} />
      ))}
      {Array.from({ length: emptySlots }, (_, index) => (
        <EmptySponsorSlot
          key={`empty-${tier.name}-${index}`}
          index={index}
          styles={styles}
          tierName={tier.name}
        />
      ))}
    </div>
  );
};

const SponsorTier = ({ tier }: { tier: Tier }) => {
  const styles = getTierStyles(tier.name);

  return (
    <div className="flex flex-col gap-3 py-6 first-of-type:pt-0">
      <TierHeader name={tier.name} styles={styles} />
      <TierGrid tier={tier} styles={styles} />
    </div>
  );
};

const SponsorIntro = () => (
  <section className="relative container-wrapper">
    <div className="container flex max-w-2xl flex-col items-center gap-4 py-16 text-center md:py-20 lg:py-24">
      <h1 className="bg-linear-to-b from-foreground via-foreground to-foreground/65 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl md:text-6xl">
        Support the ProjectWing Showroom
      </h1>
      <p className="text-base text-balance text-muted-foreground">
        The Showroom is a review surface for Project Wing&apos;s shared UI and
        registry components. It makes implementation states, provenance, and
        contribution evidence easier to inspect.
      </p>
      <p className="text-sm text-balance text-muted-foreground">
        A visible specimen is not automatically an approved product contract.
        ProjectWing contributions are reviewed against the design-system
        registry, provenance, accessibility, interaction evidence, and UI stack
        guardrails.
      </p>
      <p className="text-sm text-balance text-muted-foreground">
        There are no named sponsors listed yet. The empty tier slots are
        invitations for future, verified supporters—not claims about current
        sponsorship.
      </p>
      <ExternalLinkButton
        sound="heart"
        size="lg"
        className="mt-4"
        href={LINK.SPONSOR}
      >
        <Heart />
        Support on GitHub
        <ExternalLink className="size-3.5 opacity-60" />
      </ExternalLinkButton>
    </div>
  </section>
);

const SponsorTiers = () => (
  <section className="relative container-wrapper">
    <div className="container flex max-w-2xl flex-col">
      {tiers.map((tier) => (
        <SponsorTier key={tier.name} tier={tier} />
      ))}
    </div>
  </section>
);

const StargazerSection = ({
  stargazers,
}: {
  stargazers: Awaited<ReturnType<typeof getStargazers>>;
}) => {
  if (stargazers.length === 0) {
    return null;
  }

  return (
    <section className="relative container-wrapper">
      <div className="container max-w-2xl pt-6">
        <Card className="gap-4 py-4 shadow-none">
          <CardHeader className="flex items-center gap-3 px-4">
            <h3 className="text-xs font-bold tracking-wide text-foreground uppercase">
              Stargazers
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {stargazers.length}
            </span>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-0 px-4">
            {stargazers.map((user) => (
              <a
                key={user.login}
                href={`https://github.com/${user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                title={user.login}
                className="group relative p-1.5 transition-colors hover:bg-accent/50"
              >
                <Image
                  src={user.avatar_url}
                  alt={user.login}
                  width={36}
                  height={36}
                  className="rounded-full ring-1 ring-border transition-all group-hover:scale-110 group-hover:ring-foreground/30"
                  unoptimized
                />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

const SponsorFooter = () => (
  <section className="relative container-wrapper">
    <div className="container flex flex-col items-center gap-4 py-16 md:py-20 lg:py-24">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-bold tracking-tight">
          Want to support the project?
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          A GitHub star, issue, discussion, code review, or other contribution
          helps maintain the Showroom and its registry evidence.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <ExternalLinkButton sound="heart" href={LINK.SPONSOR}>
          <Heart />
          Support on GitHub
        </ExternalLinkButton>
        <ExternalLinkButton sound="star" variant="outline" href={LINK.GITHUB}>
          <Star />
          Star on GitHub
        </ExternalLinkButton>
      </div>
    </div>
  </section>
);

const SponsorPage = async () => {
  const stargazers = await getStargazers();

  return (
    <PageTransition>
      <SponsorIntro />
      <SponsorTiers />
      <StargazerSection stargazers={stargazers} />
      <SponsorFooter />
    </PageTransition>
  );
};

export default SponsorPage;
