import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full min-h-screen flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="min-h-96 w-full flex-1" />
    </div>
  );
}
