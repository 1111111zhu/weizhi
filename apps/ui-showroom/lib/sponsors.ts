export interface Sponsor {
  name: string;
  href: string;
  logo?: string;
}

export interface SponsorTier {
  name: "Gold" | "Silver" | "Bronze";
  slots: number;
  sponsors: Sponsor[];
}

export const tiers: SponsorTier[] = [
  {
    name: "Gold",
    slots: 3,
    sponsors: [],
  },
  {
    name: "Silver",
    slots: 3,
    sponsors: [],
  },
  {
    name: "Bronze",
    slots: 3,
    sponsors: [],
  },
];
