import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

export const Analytics = () =>
  process.env.VERCEL === "1" ? <VercelAnalytics /> : null;
