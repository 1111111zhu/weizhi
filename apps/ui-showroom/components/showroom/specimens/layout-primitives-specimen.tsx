"use client";

import {
  Button,
  Card,
  Container,
  DescriptionList,
  DetailPageLayout,
  FilterBar,
  FormPageLayout,
  Grid,
  Inline,
  Input,
  ListPageLayout,
  SectionHeader,
  Stack,
  Surface,
} from "@project-wing/ui";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

const source = {
  scope: "shared",
  library: "@project-wing/ui",
  detail: "layout primitives and page compositions",
} as const;

export function LayoutPrimitivesSpecimen() {
  const [actions, setActions] = useState(0);
  const [memo, setMemo] = useState("Unsaved draft / 未保存内容");
  const action = (
    <Button onClick={() => setActions((count) => count + 1)}>
      Run example action
    </Button>
  );
  const details = (
    <DescriptionList
      columns={2}
      items={[
        { id: "reference", label: "Reference", value: "EXAMPLE-2026-001" },
        { id: "count", label: "Count", value: 0 },
        { id: "empty", label: "Not yet provided", value: null },
        {
          id: "long",
          label: "Long localized content",
          value:
            "A long description remains readable without widening the page / 较长的中文内容同样需要换行。",
        },
      ]}
    />
  );
  return (
    <Container width="wide">
      <Stack gap="lg">
        <SpecimenSection
          id="layout-surfaces"
          title="Surface and Container"
          description="Plain, outlined, raised and subtle semantic surfaces. Border and padding are explicit; page content is not wrapped in extra frames."
          source={source}
        >
          <Grid columns={4}>
            {(["plain", "outlined", "raised", "subtle"] as const).map(
              (variant) => (
                <Surface key={variant} variant={variant} padding="md">
                  <Stack gap="sm">
                    <strong>{variant}</strong>
                    <p>Content surface</p>
                  </Stack>
                </Surface>
              )
            )}
          </Grid>
        </SpecimenSection>
        <SpecimenSection
          id="layout-flow"
          title="Stack, Inline and Grid"
          description="Responsive equal tracks and wrapping action rows. The fixed three-column example remains a 3 × 3 grid on phones."
          source={source}
        >
          <Inline>
            {action}
            <Button disabled>Disabled</Button>
            <Button loading loadingLabel="Working">
              Working
            </Button>
          </Inline>
          <Grid columns={3} collapse="never">
            {Array.from({ length: 9 }, (_, index) => (
              <Surface key={index} variant="subtle" padding="sm">
                Cell {index + 1}
              </Surface>
            ))}
          </Grid>
        </SpecimenSection>
        <SpecimenSection
          id="layout-content"
          title="Card, SectionHeader and DescriptionList"
          description="Named metadata, zero and empty values, and long-text stress cases use the same shared primitives."
          source={source}
          state={`${actions} actions`}
        >
          <Card
            heading="Record details"
            description="Actions are caller-owned; the card performs no data mutations."
            actions={action}
          >
            {details}
          </Card>
          <FilterBar aria-label="Example filters">
            <Input
              aria-label="Draft memo"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
            {action}
          </FilterBar>
        </SpecimenSection>
        <SpecimenSection
          id="layout-pages"
          title="List, detail and form layouts"
          description="Header, content, optional aside and footer remain in a predictable reading order. Forms retain their own validation and submit handler."
          source={source}
        >
          <ListPageLayout
            header={<SectionHeader heading="List layout" />}
            aside={
              <Surface variant="subtle" padding="md">
                Optional supporting information
              </Surface>
            }
            footer={action}
          >
            {details}
          </ListPageLayout>
          <DetailPageLayout
            header={<SectionHeader heading="Detail layout" />}
            aside={
              <Surface variant="subtle" padding="md">
                Record context
              </Surface>
            }
          >
            {details}
          </DetailPageLayout>
          <FormPageLayout header={<SectionHeader heading="Form layout" />}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setActions((count) => count + 1);
              }}
            >
              <Stack>
                <Input
                  aria-label="Example field"
                  required
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                />
                <Button type="submit">Submit local example</Button>
              </Stack>
            </form>
          </FormPageLayout>
        </SpecimenSection>
      </Stack>
    </Container>
  );
}
