import { ComponentSourceContent } from "@/components/component-source-content";
import { formatCode } from "@/lib/format-code";
import { highlightCode } from "@/lib/highlight-code";
import {
  getDemoSource,
  getRegistrySource,
  readOptionalFromRoot,
} from "@/lib/registry";

export const ComponentSource = async ({
  name,
  src,
  title,
  collapsible = true,
  className,
  language,
}: {
  name?: string;
  src?: string;
  title?: string;
  collapsible?: boolean;
  className?: string;
  language?: string;
}) => {
  let code: string | null = null;

  if (name) {
    code = (await getDemoSource(name)) ?? (await getRegistrySource(name));
  }

  if (src) {
    code = await readOptionalFromRoot(src);
  }

  if (!code) {
    return null;
  }

  code = await formatCode(code);

  const lang = language ?? title?.split(".").pop() ?? "tsx";
  const highlightedCode = await highlightCode(code, lang);

  return (
    <ComponentSourceContent
      code={code}
      highlightedCode={highlightedCode}
      language={lang}
      title={title}
      collapsible={collapsible}
      className={className}
    />
  );
};
