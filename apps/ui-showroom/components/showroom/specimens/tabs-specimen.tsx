"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SpecimenSection } from "./specimen-section";

export function TabsSpecimen() {
  return (
    <SpecimenSection
      description="A real local tabs wrapper with keyboard navigation, selected state, panels, and a disabled tab."
      id="tabs-specimen"
      source={{
        scope: "showroom",
        library: "@/components/ui/tabs",
        detail: "Base UI wrapper",
      }}
      title="Tabs"
    >
      <Tabs className="w-full" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger disabled value="settings">
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent className="rounded-md border p-4 text-sm" value="overview">
          Overview content is visible by default.
        </TabsContent>
        <TabsContent className="rounded-md border p-4 text-sm" value="activity">
          Activity content is selected through the trigger.
        </TabsContent>
        <TabsContent className="rounded-md border p-4 text-sm" value="settings">
          Settings is intentionally disabled in this specimen.
        </TabsContent>
      </Tabs>
    </SpecimenSection>
  );
}
