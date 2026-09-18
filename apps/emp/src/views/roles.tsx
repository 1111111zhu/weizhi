"use client";

import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";

import { api } from "../api/client";

export function RolesPage() {
  const roles = useQuery({ queryKey: ["roles"], queryFn: api.roles });
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold text-foreground">
        Role permissions
      </h1>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.data?.map((role) => (
          <Card key={role.id} className="p-5">
            <h2 className="font-semibold text-foreground">{role.code}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{role.scope}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
