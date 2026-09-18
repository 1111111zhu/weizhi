import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { LogoMark } from "@/components/logo";
import { SITE } from "@/constants/site";
import { getPageImage, source } from "@/lib/source";

export const revalidate = false;

interface OgDocsContext {
  params: Promise<{ slug: string[] }>;
}

const getTitleClasses = (title: string) =>
  title.length > 20 ? "text-[64px]" : "text-[80px]";

const OgDocsImage = ({
  description,
  title,
}: {
  description: string;
  title: string;
}) => (
  <div tw="flex h-full w-full bg-black text-white">
    <div tw="flex border absolute border-stone-700 border-dashed inset-y-0 left-16 w-[1px]" />
    <div tw="flex border absolute border-stone-700 border-dashed inset-y-0 right-16 w-[1px]" />
    <div tw="flex border absolute border-stone-700 inset-x-0 h-[1px] top-16" />
    <div tw="flex border absolute border-stone-700 inset-x-0 h-[1px] bottom-16" />
    <div tw="flex absolute flex-row bottom-24 right-24 text-white">
      <LogoMark width={48} height={48} />
    </div>
    <div tw="flex flex-col absolute w-[896px] justify-center inset-32">
      <div
        tw={`tracking-tighter ${getTitleClasses(title)} flex-grow-1 flex flex-col justify-center leading-[1.1] font-semibold`}
      >
        {title}
      </div>
      <div tw="text-[40px] leading-[1.5] flex-grow-1 text-stone-400 font-medium">
        {description}
      </div>
    </div>
  </div>
);

export const GET = async (_req: Request, { params }: OgDocsContext) => {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) {
    notFound();
  }

  const { title, description } = page.data;

  return new ImageResponse(
    <OgDocsImage
      title={title}
      description={description ?? SITE.DESCRIPTION.LONG}
    />,
    {
      height: 630,
      width: 1200,
    }
  );
};

export const generateStaticParams = () =>
  source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
