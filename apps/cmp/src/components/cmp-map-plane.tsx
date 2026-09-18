"use client";

import type {
  CmpClientGraph,
  CmpEntityRelationshipsResponse,
  CmpGroupRelationshipsResponse,
  CmpRelatedEntitiesResponse,
} from "@project-wing/shared/cmp-entity-graph";
import { ViewSwitcher, useCompactViewport } from "@project-wing/ui";
import { Network } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { api } from "@/api/client";
import { CmpEntityStructureGraph } from "@/components/cmp-entity-structure-graph";
import {
  PartyRelationshipsManager,
  RelatedPartiesManager,
} from "@/components/cmp-related-parties-manager";
import { useCmpToast } from "@/components/cmp-toast";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCmpI18n } from "@/i18n/client";

export function CmpMapPlane({
  engagementHref: _engagementHref,
  clientHrefForId: _clientHrefForId,
}: {
  engagementHref: string;
  clientHrefForId: (clientId: string) => string;
}) {
  const phone = useCompactViewport(767.98);
  const { dictionary, locale } = useCmpI18n();
  const { toast } = useCmpToast();
  const copy = dictionary.mapPlane;
  const zh = locale === "zh-CN";
  const [clients, setClients] = useState<
    Awaited<ReturnType<typeof api.cmpClients>>["clients"]
  >([]);
  const [clientId, setClientId] = useState("");
  const [graph, setGraph] = useState<CmpClientGraph>();
  const [entities, setEntities] = useState<CmpRelatedEntitiesResponse>();
  const [relationships, setRelationships] =
    useState<CmpEntityRelationshipsResponse>();
  const [groupRelationships, setGroupRelationships] =
    useState<CmpGroupRelationshipsResponse>();
  const [view, setView] = useState<"parties" | "relationships" | "structure">(
    "parties"
  );
  const selectedClient = clients.find((client) => client.id === clientId);

  useEffect(() => {
    void api
      .cmpClients()
      .then((response) => {
        setClients(response.clients);
        setClientId((current) => current || response.clients[0]?.id || "");
      })
      .catch(() =>
        toast({ title: copy.couldNotLoadClients, variant: "destructive" })
      );
  }, [copy.couldNotLoadClients, toast]);

  const reload = useCallback(async () => {
    if (!clientId) {
      return;
    }
    try {
      const [
        nextGraph,
        nextEntities,
        nextRelationships,
        nextGroupRelationships,
      ] = await Promise.all([
        api.cmpClientGraph(clientId),
        api.cmpRelatedEntities(clientId),
        api.cmpEntityRelationships(clientId),
        api.cmpGroupRelationships(clientId),
      ]);
      setGraph(nextGraph);
      setEntities(nextEntities);
      setRelationships(nextRelationships);
      setGroupRelationships(nextGroupRelationships);
    } catch {
      toast({ title: copy.couldNotLoadEntityGraph, variant: "destructive" });
    }
  }, [clientId, copy.couldNotLoadEntityGraph, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <section className="cmp-map-plane flex h-[calc(100dvh-5.5rem)] min-h-[620px] flex-col overflow-hidden border-t bg-background">
      <header className="flex flex-wrap items-center gap-4 border-b bg-card px-6 py-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Network className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">
            {zh ? "主体结构" : "Entity Structure"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {zh
              ? "由事务所主体主数据和直接关系自动生成。"
              : "Generated from firm-level party master data and direct relationships."}
          </p>
        </div>
        <Select
          value={clientId || null}
          onValueChange={(value) => setClientId(value ?? "")}
        >
          <SelectTrigger
            className="ml-auto w-80"
            aria-label={zh ? "选择客户" : "Select client"}
          >
            <SelectValue placeholder={zh ? "选择客户" : "Select client"}>
              {selectedClient
                ? `${selectedClient.clientCode} · ${selectedClient.nameEn || selectedClient.nameZh}`
                : ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.clientCode} · {client.nameEn || client.nameZh}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <nav className="border-b bg-card px-6 py-2">
        {phone ? (
          <ViewSwitcher
            label={zh ? "查看内容" : "View"}
            value={view}
            options={[
              { value: "parties", label: zh ? "相关主体" : "Related Parties" },
              {
                value: "relationships",
                label: zh ? "主体关系" : "Party Relationships",
              },
              {
                value: "structure",
                label: zh ? "主体结构" : "Entity Structure",
              },
            ]}
            onValueChange={(value) => setView(value as typeof view)}
            mobilePresentation="sheet"
          />
        ) : (
          <ButtonGroup>
            {(
              [
                ["parties", zh ? "相关主体" : "Related Parties"],
                ["relationships", zh ? "主体关系" : "Party Relationships"],
                ["structure", zh ? "主体结构" : "Entity Structure"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                variant={view === id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(id)}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
        )}
      </nav>

      <div className="relative min-h-0 flex-1">
        {view === "parties" ? (
          <RelatedPartiesManager
            clientId={clientId}
            entities={entities}
            zh={zh}
            onChanged={reload}
          />
        ) : view === "relationships" ? (
          <PartyRelationshipsManager
            clientId={clientId}
            entities={entities}
            relationships={relationships}
            groupRelationships={groupRelationships}
            zh={zh}
            onChanged={reload}
          />
        ) : graph ? (
          <CmpEntityStructureGraph
            graph={graph}
            zh={zh}
            className="h-full rounded-none border-0"
          />
        ) : (
          <div className="h-full" />
        )}
      </div>
    </section>
  );
}

export { layoutClientGraph } from "@/components/cmp-entity-structure-graph";
