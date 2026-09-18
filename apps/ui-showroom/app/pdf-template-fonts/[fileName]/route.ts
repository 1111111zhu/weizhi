import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const FONT_FILES = new Set([
  "LiberationSans-Bold.ttf",
  "LiberationSans-BoldItalic.ttf",
  "LiberationSans-Italic.ttf",
  "LiberationSans-Regular.ttf",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileName: string }> }
) {
  const { fileName } = await context.params;
  if (!FONT_FILES.has(fileName)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    // Next dev and standalone both run from this app's directory. Keep the
    // filesystem prefix explicit so tracing includes fonts, not the repository.
    const body = await readFile(
      path.join(process.cwd(), "../emp/public/pdfjs/standard_fonts", fileName)
    );
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "font/ttf",
      },
    });
  } catch {
    return new NextResponse("Font unavailable", { status: 503 });
  }
}
