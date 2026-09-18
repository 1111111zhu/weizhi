import { CodeBlockCommand } from "@/components/code-block-command";
import { registryItemUrl } from "@/lib/utils";

export const RegistryInstallCommand = ({ name }: { name: string }) => {
  const itemUrl = registryItemUrl(name);
  return (
    <CodeBlockCommand
      __bun__={`bunx --bun shadcn@latest add ${itemUrl}`}
      __npm__={`npx shadcn@latest add ${itemUrl}`}
      __pnpm__={`pnpm dlx shadcn@latest add ${itemUrl}`}
      __yarn__={`yarn dlx shadcn@latest add ${itemUrl}`}
    />
  );
};
