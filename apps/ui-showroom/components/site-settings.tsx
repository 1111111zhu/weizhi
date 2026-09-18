"use client";

import { useSiteSettingsControls } from "@/components/site-settings-controls";
import { SiteSettingsPanel } from "@/components/site-settings-panel";

export const SiteSettings = () => {
  const controls = useSiteSettingsControls();
  return <SiteSettingsPanel {...controls} />;
};
