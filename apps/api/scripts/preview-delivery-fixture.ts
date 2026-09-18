// Local-only HTTP/browser regression fixture. Uses production preview code,
// synthetic storage and a fixture login; never uses production credentials/data.
import "reflect-metadata";
import express from "express";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { DocumentConversionService } from "../src/workflow/document-conversion.service";
import { WorkflowController } from "../src/workflow/workflow.controller";
import { WorkflowService } from "../src/workflow/workflow.service";

async function main() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([420, 300]).drawText("Preview delivery regression: valid PDF", {
    x: 24,
    y: 230,
    size: 16,
    font,
  });
  const bytes = Buffer.from(await pdf.save());
  let expired = false;
  let origin = "";
  let signedRequests = 0;
  const objectKey = "working-papers/fixture/document.pdf";
  const storage = {
    getDownloadObject: () => ({
      fileName: "fixture.pdf",
      mimeType: "application/pdf",
      redirectUrl: `${origin}/oss?Expires=1`,
    }),
    getObjectBuffer: (key: string) => {
      if (key !== objectKey) {
        throw new Error("Unexpected object");
      }
      return Promise.resolve(bytes);
    },
  };
  const attachment = {
    id: "document",
    projectId: "fixture",
    fileKind: "SUPPORTING",
    fileName: "fixture.pdf",
    originalName: "fixture.pdf",
    fileUrl: objectKey,
    mimeType: "application/pdf",
    version: 1,
  };
  const workflow = new WorkflowService(
    { attachment: { findFirst: () => Promise.resolve(attachment) } } as never,
    {
      requireProjectMember: (projectId: string, userId: string) => {
        if (projectId !== "fixture" || userId !== "fixture-user") {
          throw new Error("Forbidden");
        }
        return Promise.resolve();
      },
    } as never,
    {} as never,
    new DocumentConversionService(storage as never),
    undefined,
    storage as never
  );
  const controller = new WorkflowController(workflow, {} as never, {} as never);
  const app = express();
  app.use(express.json());
  app.post("/login", (_req, res) => {
    res.cookie("fixture-session", "local-only", {
      httpOnly: true,
      sameSite: "strict",
    });
    res.json({ ok: true });
  });
  app.post("/logout", (_req, res) => {
    res.clearCookie("fixture-session");
    res.json({ ok: true });
  });
  app.post("/expire", (_req, res) => {
    expired = true;
    res.json({ ok: true });
  });
  app.get("/metrics", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ expired, signedRequests });
  });
  app.get("/oss", (_req, res) => {
    signedRequests += 1;
    res.setHeader("Cache-Control", "no-store");
    if (expired) {
      res
        .status(403)
        .type("application/xml")
        .send(
          "<Error><Code>AccessDenied</Code><Message>Request has expired.</Message><EC>0002-00000069</EC></Error>"
        );
      return;
    }
    res.type("application/pdf").send(bytes);
  });
  const route =
    "/engagement/fixture/workflow/attachments/document/preview-pdf/fixture";
  app.get(route, (req, res) => {
    if (!req.headers.cookie?.includes("fixture-session=local-only")) {
      res.status(403).setHeader("Cache-Control", "no-store");
      res.json({ code: "FORBIDDEN" });
      return;
    }
    if (req.query.previewDelivery !== "content-v2") {
      // Reproduce the old response at the old cache identity. Fixed requests
      // use the new identity and the production controller/service below.
      res.setHeader("Cache-Control", "private, max-age=604800, immutable");
      res.setHeader("ETag", '"legacy-redirect"');
      res.redirect(302, `${origin}/oss?Expires=1`);
      return;
    }
    void controller
      .previewAttachmentPdfWithDisplayName(
        "fixture",
        "document",
        { id: "fixture-user" } as never,
        res,
        req.headers["if-none-match"],
        "1"
      )
      .catch((error: unknown) => {
        res.status(500).json({ message: String(error) });
      });
  });
  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html")
      .send(`<!doctype html><html lang="en"><head><title>Preview delivery regression</title></head><body>
      <h1>Preview delivery regression</h1><p>Isolated fixture: no production data or credentials.</p>
      <button id="login">Sign in to fixture</button><button id="old">Open legacy preview</button>
      <button id="expire">Expire old signature</button><button id="fixed">Open fixed preview</button><button id="logout">Sign out</button>
      <pre id="result" role="status">Ready</pre><iframe title="PDF preview" style="width:100%;height:440px;border:1px solid #ccc"></iframe>
      <script>
        const route = ${JSON.stringify(route)};
        const result = document.querySelector('#result');
        let objectUrl;
        async function command(path, message) { await fetch(path, { method: 'POST' }); result.textContent = message; }
        document.querySelector('#login').onclick = () => command('/login', 'Fixture signed in');
        document.querySelector('#logout').onclick = () => command('/logout', 'Fixture signed out');
        document.querySelector('#expire').onclick = () => command('/expire', 'Old OSS signature expired');
        async function preview(fixed) {
          const requested = route + '?version=1' + (fixed ? '&previewDelivery=content-v2' : '');
          const response = await fetch(requested);
          const body = await response.blob();
          const text = await body.text();
          result.textContent = JSON.stringify({ status: response.status, redirected: response.redirected, pdf: text.startsWith('%PDF-'), bytes: body.size, url: response.url, cacheControl: response.headers.get('cache-control') }, null, 2);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          if (response.ok && text.startsWith('%PDF-')) { objectUrl = URL.createObjectURL(body); document.querySelector('iframe').src = objectUrl; }
        }
        document.querySelector('#old').onclick = () => preview(false);
        document.querySelector('#fixed').onclick = () => preview(true);
      </script></body></html>`);
  });
  const server = app.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Missing fixture port");
    }
    origin = `http://127.0.0.1:${address.port}`;
    console.log(`PREVIEW_FIXTURE_URL=${origin}`);
  });
  setTimeout(() => server.close(), 15 * 60_000).unref();
}
void main();
