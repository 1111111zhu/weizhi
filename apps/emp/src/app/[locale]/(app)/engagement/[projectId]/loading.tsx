import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-full min-h-96 w-full flex-1" />
    </div>
  );
}
