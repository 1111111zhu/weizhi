import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import {
  CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
import type { SmartFormV2CompiledDefinition } from "@project-wing/shared";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
} from "pdf-lib";

import {
  SmartFormV2PdfService,
  renderSmartFormV2TypstSource,
  addSmartFormV2CommentAnnotations,
} from "./smart-form-v2-pdf.service";

describe(SmartFormV2PdfService, () => {
  it.each([
    "DOCUMENT REVIEW",
    "DOCUMENT REVIEW - Annual balances and subsequent receipts reconciliation with supporting evidence and detailed audit procedures",
  ])(
    "groups 100 external Q at the actual title without moving row notes (%s)",
    async (title) => {
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
      );
      definition.title.values["en-US"] = {
        type: "doc",
        version: 1,
        content: [
          {
            id: "external-title",
            type: "paragraph",
            content: [{ type: "text", text: title }],
          },
        ],
      };
      const questions = Array.from({ length: 100 }, (_, i) => ({
        id: `external-${i}`,
        body: `External question ${i}`,
        status: "OPEN",
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, i)),
        messages: [
          {
            id: `reply-${i}`,
            messageType: "REPLY",
            body: `Reply ${i}`,
            createdAt: new Date(Date.UTC(2026, 8, 2, 0, 0, i)),
          },
        ],
      }));
      const row = {
        id: "row-q",
        body: "Row question",
        status: "OPEN",
        createdAt: new Date("2026-09-01"),
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-1",
      };
      const service = new SmartFormV2PdfService();
      const baseline = await service.renderSmartFormV2Pdf({
        definition,
        locale: "en-US",
        reviewQuestions: [row],
      });
      const pdf = await service.renderSmartFormV2Pdf({
        definition,
        locale: "en-US",
        reviewQuestions: [...questions, row],
      });
      const document = await PDFDocument.load(pdf);
      const base = await PDFDocument.load(baseline);
      expect(document.getPageCount()).toBe(base.getPageCount());
      const all = document.getPages().flatMap((p, pageIndex) => {
        const a = p.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
        return a
          ? Array.from({ length: a.size() }, (_, i) => ({
              pageIndex,
              note: a.lookup(i, PDFDict),
            }))
          : [];
      });
      expect(all).toHaveLength(2);
      const external = all.find(
        ({ note }) =>
          note.lookup(PDFName.of("NM"), PDFHexString).decodeText() ===
          "external-0"
      )!;
      expect(external.pageIndex).toBe(0);
      const data = JSON.parse(
        external.note
          .lookup(PDFName.of("EPDFCustom"), PDFHexString)
          .decodeText()
      ).projectWingReview;
      expect(data.questions).toHaveLength(100);
      expect(
        data.questions[99].messages.map((m: { body: string }) => m.body)
      ).toStrictEqual(["External question 99", "Reply 99"]);
      const rect = external.note
        .lookup(PDFName.of("Rect"), PDFArray)
        .asArray()
        .map((n) => (n as PDFNumber).asNumber());
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const task = getDocument({
        data: new Uint8Array(pdf),
        useSystemFonts: true,
      });
      try {
        const parsed = await task.promise;
        const page = await parsed.getPage(1);
        const text = await page.getTextContent();
        const titleItems = text.items.filter(
          (item) => "str" in item && item.str.trim() && item.height >= 17
        );
        expect(titleItems.length).toBeGreaterThan(0);
        const last = titleItems.at(-1)!;
        if (!("str" in last)) throw new Error("Missing title text");
        const titleText = titleItems.filter((item) => "str" in item);
        const right = Math.max(
          ...titleText.map((item) => item.transform[4] + item.width)
        );
        expect(rect[0]).toBeGreaterThanOrEqual(right + 3);
        if (title === "DOCUMENT REVIEW") {
          expect(rect[0] - right).toBeLessThan(15);
        }
        expect(rect[1]).toBeGreaterThan(
          Math.min(...titleText.map((item) => item.transform[5])) - 18
        );
        expect(rect[1]).toBeLessThan(
          Math.max(...titleText.map((item) => item.transform[5])) + 18
        );
        expect(rect[2]).toBeLessThanOrEqual(document.getPage(0).getWidth());
      } finally {
        await task.destroy();
      }
      const rowRect = all
        .find(
          ({ note }) =>
            note.lookup(PDFName.of("NM"), PDFHexString).decodeText() === "row-q"
        )!
        .note.lookup(PDFName.of("Rect"), PDFArray)
        .toString();
      expect(rowRect).toBe(
        base
          .getPage(0)
          .node.lookup(PDFName.of("Annots"), PDFArray)
          .lookup(0, PDFDict)
          .lookup(PDFName.of("Rect"), PDFArray)
          .toString()
      );
    },
    30000
  );

  it("groups legacy external Q even when no title anchor is available", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const bytes = await addSmartFormV2CommentAnnotations(
      Buffer.from(await source.save()),
      [],
      Array.from({ length: 500 }, (_, i) => ({
        id: `external-${i}`,
        body: `Question ${i}`,
        status: "OPEN",
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, i)),
      }))
    );
    const pdf = await PDFDocument.load(bytes);
    const notes = pdf.getPage(0).node.lookup(PDFName.of("Annots"), PDFArray);
    expect(notes.size()).toBe(1);
    const note = notes.lookup(0, PDFDict);
    expect(
      note.lookup(PDFName.of("Contents"), PDFHexString).decodeText()
    ).toContain("Question 499");
    expect(
      JSON.parse(
        note.lookup(PDFName.of("EPDFCustom"), PDFHexString).decodeText()
      ).projectWingReview.questions
    ).toHaveLength(500);
  });
  it("keeps multiple Q threads and rounds ordered, complete and separate without mutating source", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const questions = [2, 1, 3].map((q) => ({
      id: `q${q}`,
      smartFormNodeId: "sheet",
      smartFormRowId: q === 3 ? "other-row" : "same-row",
      body: `Question ${q}`,
      status: q === 2 ? "REPLIED" : "OPEN",
      createdAt: `2026-09-01T10:0${q}:00Z`,
      messages: [3, 1, 2].map((round) => ({
        id: `q${q}-m${round}`,
        messageType:
          round === 1 ? "QUESTION" : round === 2 ? "REPLY" : "FOLLOW_UP",
        body: `**Q${q} round ${round}**\n[Source](https://example.com/q${q})`,
        createdAt: `2026-09-01T11:0${round}:00Z`,
        author: { name: `Author ${round}` },
        images:
          round === 2 ? [{ id: `image-${q}`, fileName: "evidence.png" }] : [],
        references:
          round === 3
            ? [
                {
                  workingPaper: {
                    id: `paper-${q}`,
                    code: "A1",
                    title: "Evidence",
                  },
                },
              ]
            : [],
      })),
    }));
    const before = JSON.stringify(questions);
    const result = await addSmartFormV2CommentAnnotations(
      Buffer.from(await source.save()),
      [],
      questions
    );
    const pdf = await PDFDocument.load(result);
    const annots = pdf.getPage(0).node.lookup(PDFName.of("Annots"), PDFArray);
    expect(annots.size()).toBe(2);
    const first = annots.lookup(0, PDFDict);
    const metadata = JSON.parse(
      first.lookup(PDFName.of("EPDFCustom"), PDFHexString).decodeText()
    ).projectWingReview;
    expect(metadata.questions.map((q: { id: string }) => q.id)).toStrictEqual([
      "q1",
      "q2",
    ]);
    expect(
      metadata.questions[0].messages.map((m: { id: string }) => m.id)
    ).toStrictEqual(["q1-m1", "q1-m2", "q1-m3"]);
    expect(metadata.questions[0].messages[1].images[0].id).toBe("image-1");
    expect(metadata.questions[1].messages[2].references[0].id).toBe("paper-2");
    const fallback = first
      .lookup(PDFName.of("Contents"), PDFHexString)
      .decodeText();
    expect(fallback).toContain("Q1 round 3");
    expect(fallback).toContain("Q2 round 3");
    expect(fallback).not.toContain("Q3 round");
    expect(JSON.stringify(questions)).toBe(before);
  });

  it("retains an older root question and legacy reply when a partial message history exists", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const bytes = await addSmartFormV2CommentAnnotations(
      Buffer.from(await source.save()),
      [],
      [
        {
          id: "legacy",
          body: "Original question",
          replyBody: "Legacy reply",
          status: "OPEN",
          createdAt: "2026-09-01",
          repliedAt: "2026-09-02",
          messages: [
            {
              id: "follow",
              messageType: "FOLLOW_UP",
              body: "Latest follow-up",
              createdAt: "2026-09-03",
            },
          ],
        },
      ]
    );
    const pdf = await PDFDocument.load(bytes);
    const metadata = JSON.parse(
      pdf
        .getPage(0)
        .node.lookup(PDFName.of("Annots"), PDFArray)
        .lookup(0, PDFDict)
        .lookup(PDFName.of("EPDFCustom"), PDFHexString)
        .decodeText()
    );
    expect(
      metadata.projectWingReview.questions[0].messages.map(
        (m: { body: string }) => m.body
      )
    ).toStrictEqual(["Original question", "Legacy reply", "Latest follow-up"]);
  });
  it("preserves rich Notes and a standard fallback without changing page count", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const document = {
      type: "doc" as const,
      version: 1 as const,
      content: [
        {
          type: "paragraph" as const,
          id: "note",
          content: [
            {
              type: "text" as const,
              text: "Evidence",
              marks: [{ type: "bold" as const }],
            },
          ],
        },
      ],
    };
    const result = await addSmartFormV2CommentAnnotations(
      Buffer.from(await source.save()),
      [{ title: "Notes", content: "Evidence", document }]
    );
    const pdf = await PDFDocument.load(result);
    expect(pdf.getPageCount()).toBe(1);
    const note = pdf
      .getPage(0)
      .node.lookup(PDFName.of("Annots"), PDFArray)
      .lookup(0, PDFDict);
    expect(note.lookup(PDFName.of("Contents"), PDFHexString).decodeText()).toBe(
      "Evidence"
    );
    expect(note.lookup(PDFName.of("Subj"), PDFHexString).decodeText()).toBe(
      "Notes"
    );
    expect(note.lookup(PDFName.of("RC"), PDFHexString).decodeText()).toContain(
      "font-weight:bold"
    );
    expect(
      JSON.parse(
        note.lookup(PDFName.of("EPDFCustom"), PDFHexString).decodeText()
      )
    ).toEqual({ projectWingNote: { version: 1, document } });
  });
  it("renders the compiled audit-programme AST as a PDF", async () => {
    const service = new SmartFormV2PdfService();
    const pdf = await service.renderSmartFormV2Pdf({
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
      locale: "zh-CN",
      fileName: "deferred-income.sf",
      documentVersion: "v2.0",
      generatedAt: new Date("2026-07-31T00:00:00.000Z"),
      engagementDetails: {
        clientName: "Wuhan Wodetong Supply Chain Technology Co., Ltd",
        engagementCode: "WDT-2026-AUD",
        financialStatementDate: new Date("2026-03-31T00:00:00.000Z"),
      },
    });

    expect(pdf.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10_000);
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(2);
    const annotations = document.getPages().flatMap((page) => {
      const pageAnnotations = page.node.lookupMaybe(
        PDFName.of("Annots"),
        PDFArray
      );
      return pageAnnotations
        ? Array.from({ length: pageAnnotations.size() }, (_, index) =>
            pageAnnotations.lookup(index, PDFDict)
          )
        : [];
    });
    expect(annotations).toHaveLength(4);
    expect(
      annotations.map((annotation) =>
        annotation.lookup(PDFName.of("Contents"), PDFHexString).decodeText()
      )
    ).toContain("主表已与总账核对，无差异。");
    expect(
      annotations.every(
        (annotation) =>
          annotation.lookup(PDFName.of("F"), PDFNumber).asNumber() === 644
      )
    ).toBeTruthy();
  }, 30_000);

  it("keeps the source renderer deterministic and AST-driven", () => {
    const source = renderSmartFormV2TypstSource({
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
      locale: "zh-CN",
      fileName: "deferred-income.sf",
      engagementDetails: {
        clientName: "Wuhan Wodetong Supply Chain Technology Co., Ltd",
        engagementCode: "WDT-2026-AUD",
        financialStatementDate: "2026-03-31T00:00:00.000Z",
      },
    });

    expect(source).toContain("@preview/easy-paper:0.2.2");
    expect(source).toContain("#show: project.with(");
    expect(source).toContain('"Noto Sans SC"');
    expect(source).toContain("Noto Serif CJK SC");
    expect(source).toContain("title-font: sans-fonts");
    expect(source).toContain("#v(1em)");
    expect(source).toContain('#let faint = rgb("#4b5563")');
    expect(source).toContain("table.header(");
    expect(source).not.toContain("#set page(");
    expect(source).toContain("递延收入审计程序");
    expect(source.indexOf("审计目标")).toBeLessThan(
      source.indexOf("一般审计程序")
    );
    expect(source).not.toContain("章节 1 一般审计程序");
    expect(source).toContain('"客户名称"');
    expect(source).toContain("Wuhan Wodetong Supply Chain Technology Co., Ltd");
    expect(source).toContain('"业务编号"');
    expect(source).toContain("WDT-2026-AUD");
    expect(source).toContain('"财务报表日期"');
    expect(source).toContain("2026-03-31");
    expect(source).toContain('"编制签核人"');
    expect(source).toContain('"审批签核人"');
    expect(source).toContain('"待签核"');
    expect(source).toContain("#v(2em)");
    expect(source).not.toContain("生成时间");
    expect(source).not.toContain("版本");
    expect(source).toContain("#table(");
    expect(source).toContain("2(a)");
    expect(source).toContain("将本期数据与以前期间数据进行比较");
    expect(source).toContain("本期余额较上期增加 8.4%");
    expect(source).toContain("确认，无例外事项");
    expect(source).not.toContain(
      '#text(size: 9.5pt, weight: "bold", fill: ink, "例外事项或补充说明（可选）") #text(fill: accent, "* 必填")'
    );
    expect(source).not.toContain("不满意");
    expect(source).not.toContain("○");
    expect(source).not.toContain("AUDIT_PROCEDURE");
  });

  it("renders only the first active conditional arm", () => {
    const renderFor = (optionId: string) =>
      renderSmartFormV2TypstSource({
        definition: CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
        response: {
          kind: "smartFormResponse",
          schemaVersion: 2,
          definitionVersionId:
            CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE.id,
          responseLocale: "en-US",
          updatedAt: "2026-08-28T00:00:00.000Z",
          fields: {
            "inventory-applicability-question": {
              type: "choice",
              selectedOptionIds: [optionId],
            },
          },
          sheets: {},
        },
        locale: "en-US",
      });

    const matched = renderFor("yes");
    expect(matched).toContain(
      "Perform inventory attendance and valuation testing."
    );
    expect(matched).not.toContain(
      "Document why inventory procedures do not apply."
    );

    const otherwise = renderFor("no");
    expect(otherwise).toContain(
      "Document why inventory procedures do not apply."
    );
    expect(otherwise).not.toContain(
      "Perform inventory attendance and valuation testing."
    );
  });

  it("localizes engagement labels for English PDFs", () => {
    const source = renderSmartFormV2TypstSource({
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      locale: "en-US",
      engagementDetails: {
        clientName: "Example Client",
        engagementCode: "EXAMPLE-2026-AUD",
        financialStatementDate: "2026-03-31T00:00:00.000Z",
      },
    });

    expect(source).toContain('"Client Name"');
    expect(source).toContain('"Engagement Code"');
    expect(source).toContain('"Financial Statement Date"');
    expect(source).toContain("31 March 2026");
    expect(source).toContain('"Prepared and signed by"');
    expect(source).not.toContain('"客户名称"');
  });

  it("renders every current signatory once in role-grouped author positions", async () => {
    const signoffs = [
      ["PREPARER", "Jony Ma", "2026-09-01T08:00:00.000Z"],
      ["PREPARER", "King Su", "2026-09-02T08:00:00.000Z"],
      ["PREPARER", "Senior Wang", "2026-09-03T08:00:00.000Z"],
      ["REVIEWER", "Eden Chan", "2026-09-04T08:00:00.000Z"],
      ["REVIEWER", "Partner Chen", "2026-09-05T08:00:00.000Z"],
    ].map(([type, userName, signedAt]) => ({
      type: type as "PREPARER" | "REVIEWER",
      userName,
      signedAt,
    }));
    const input = {
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
      locale: "zh-CN",
      engagementDetails: {
        clientName: "Orchid Technology Limited",
        engagementCode: "ORC-2026-AUD",
        financialStatementDate: "2026-12-31T00:00:00.000Z",
      },
      signoffs,
    };
    const source = renderSmartFormV2TypstSource(input);

    for (const signoff of signoffs) {
      expect(source).toContain(signoff.userName);
      expect(source).toContain(signoff.signedAt.slice(0, 10));
    }
    expect(source).not.toContain('"签核记录"');
    expect(source).not.toContain('"待签核"');

    const pdf = await new SmartFormV2PdfService().renderSmartFormV2Pdf(input);
    expect(pdf.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(2);
  }, 30_000);

  it("compiles legal rich-text tables, quotations, and embedded references through EasyPaper", () => {
    const definition = {
      ...CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
      i18n: {
        defaultLocale: "zh-CN",
        supportedLocales: ["zh-CN"],
        fallbackLocales: {},
        publishingPolicy: "all-supported-required",
      },
      children: [
        {
          kind: "content",
          id: "rich-content",
          content: {
            values: {
              "zh-CN": {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "blockquote",
                    id: "quote",
                    content: [
                      {
                        type: "paragraph",
                        id: "quote-paragraph",
                        content: [{ type: "text", text: "关键专业判断" }],
                      },
                    ],
                  },
                  {
                    type: "table",
                    id: "static-table",
                    rows: [
                      {
                        id: "header-row",
                        cells: [
                          {
                            id: "header-a",
                            content: [
                              {
                                type: "paragraph",
                                id: "header-a-text",
                                content: [{ type: "text", text: "项目" }],
                              },
                            ],
                          },
                          {
                            id: "header-b",
                            content: [
                              {
                                type: "paragraph",
                                id: "header-b-text",
                                content: [{ type: "text", text: "结果" }],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        id: "body-row",
                        cells: [
                          {
                            id: "body-a",
                            content: [
                              {
                                type: "paragraph",
                                id: "body-a-text",
                                content: [{ type: "text", text: "测试" }],
                              },
                            ],
                          },
                          {
                            id: "body-b",
                            content: [
                              {
                                type: "paragraph",
                                id: "body-b-text",
                                content: [{ type: "text", text: "通过" }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    type: "embed",
                    id: "embed",
                    entityType: "workingPaper",
                    entityId: "paper-1",
                    labelSnapshot: "C1-2100-F003",
                  },
                ],
              },
            },
          },
        },
      ],
    } as unknown as SmartFormV2CompiledDefinition;

    const source = renderSmartFormV2TypstSource({
      definition,
      locale: "zh-CN",
    });
    const compiler = NodeCompiler.create();
    const compiled = compiler.compile({ mainFileContent: source });
    expect(compiled.hasError()).toBeFalsy();
    if (!compiled.result) {
      throw new Error("EasyPaper compilation returned no document");
    }
    expect(compiler.pdf(compiled.result).subarray(0, 5).toString("utf-8")).toBe(
      "%PDF-"
    );
  }, 30_000);

  it("combines same-row questions into one native annotation with full localized discussions", async () => {
    const service = new SmartFormV2PdfService();
    const target = {
      smartFormNodeId: "deferred-income-general-procedures",
      smartFormRowId: "deferred-income-procedure-2-a",
      smartFormTargetLabel: "Procedure 2(a)",
    };
    const pdf = await service.renderSmartFormV2Pdf({
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
      locale: "en-US",
      reviewQuestions: [
        {
          id: "question-1",
          ...target,
          body: "Explain the variance.",
          status: "OPEN",
          createdAt: "2026-08-01T10:00:00.000Z",
          createdBy: { name: "Reviewer One" },
          messages: [
            {
              id: "message-1",
              messageType: "QUESTION",
              body: "Explain the variance.",
              createdAt: "2026-08-01T10:00:00.000Z",
              author: { name: "Reviewer One" },
            },
          ],
        },
        {
          id: "question-2",
          ...target,
          body: "Attach the reconciliation.",
          status: "REPLIED",
          createdAt: "2026-08-01T10:05:00.000Z",
          createdBy: { name: "Reviewer Two" },
        },
      ],
    });
    const document = await PDFDocument.load(pdf);
    const reviewAnnotations = document.getPages().flatMap((page, pageIndex) => {
      const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annotations) {
        return [];
      }
      return Array.from({ length: annotations.size() }, (_, index) => {
        const annotation = annotations.lookup(index, PDFDict);
        const name = annotation.lookupMaybe(PDFName.of("NM"), PDFHexString);
        return name ? { pageIndex, id: name.decodeText(), annotation } : null;
      }).filter((value): value is NonNullable<typeof value> => Boolean(value));
    });

    expect(reviewAnnotations.map((item) => item.id)).toStrictEqual([
      "question-1",
    ]);
    expect(
      reviewAnnotations[0].annotation
        .lookup(PDFName.of("Contents"), PDFHexString)
        .decodeText()
    ).toContain("Reviewer One\n");
    const combined = reviewAnnotations[0].annotation
      .lookup(PDFName.of("Contents"), PDFHexString)
      .decodeText();
    expect(combined).toContain("Q1 · Awaiting reply");
    expect(combined).toContain("Q2 · Replied");
    expect(combined).toContain("Attach the reconciliation.");
    expect(combined).toContain("Compare the current figures");
    expect(
      reviewAnnotations[0].annotation
        .lookup(PDFName.of("T"), PDFHexString)
        .decodeText()
    ).toBe("Review notes · 2 questions");
    expect(reviewAnnotations[0].annotation.has(PDFName.of("AP"))).toBeFalsy();
    expect(
      reviewAnnotations[0].annotation
        .lookup(PDFName.of("Subtype"), PDFName)
        .toString()
    ).toBe("/Text");
    expect(
      reviewAnnotations[0].annotation
        .lookup(PDFName.of("Name"), PDFName)
        .toString()
    ).toBe("/Comment");
    expect(
      reviewAnnotations[0].annotation
        .lookup(PDFName.of("Contents"), PDFHexString)
        .decodeText()
    ).toContain("UTC");
    expect(
      reviewAnnotations.every(
        ({ annotation }) =>
          annotation.lookup(PDFName.of("F"), PDFNumber).asNumber() === 644
      )
    ).toBeTruthy();
  }, 30_000);

  it("places row review notes beside the actual PDF text, including group rows and later pages", async () => {
    const targets = [
      ["general", "1", "Obtain and check"],
      ["general", "2", "Carry out analytical"],
      ["general", "2-a", "Compare the current"],
      ["general", "2-b", "Review and compare"],
      ["conclusion", "11", "Assess whether"],
    ];
    const pdf = await new SmartFormV2PdfService().renderSmartFormV2Pdf({
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      locale: "en-US",
      reviewQuestions: targets.map(([section, row, phrase], index) => ({
        id: `row-position-${index}`,
        smartFormNodeId: `deferred-income-${section}-procedures`,
        smartFormRowId: `deferred-income-procedure-${row}`,
        body: phrase,
        status: "OPEN",
        createdAt: "2026-09-06T03:00:00.000Z",
      })),
    });
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({
      data: new Uint8Array(pdf),
      useSystemFonts: true,
    });
    const document = await task.promise;
    const matches: string[] = [];
    const matchedPages = new Set<number>();
    try {
      for (
        let pageNumber = 1;
        pageNumber <= document.numPages;
        pageNumber += 1
      ) {
        const page = await document.getPage(pageNumber);
        const text = await page.getTextContent();
        const annotations = await page.getAnnotations();
        for (let index = 0; index < annotations.length; index += 1) {
          for (const other of annotations.slice(index + 1)) {
            const { rect } = annotations[index];
            expect(rect[0]).toBe(other.rect[0]);
            expect(rect[1] - other.rect[1]).toBeGreaterThanOrEqual(24);
          }
        }
        for (const [_section, _row, phrase] of targets) {
          const row = text.items.find(
            (item) => "str" in item && item.str.includes(phrase)
          );
          if (!row || !("transform" in row)) {
            continue;
          }
          const note = annotations.find((annotation) =>
            annotation.contentsObj?.str.includes(phrase)
          );
          expect(
            note,
            `Missing note beside ${phrase} on page ${pageNumber}`
          ).toBeDefined();
          // Annotation rectangle surrounds the first line of the target row;
          // checking actual PDF text catches missing anchors and top-of-page fallbacks.
          expect(Math.abs(note.rect[1] - row.transform[5])).toBeLessThan(20);
          matches.push(phrase);
          matchedPages.add(pageNumber);
        }
      }
      expect(matches).toStrictEqual(targets.map((target) => target[2]));
      expect(matchedPages.size).toBeGreaterThan(1);
    } finally {
      await task.destroy();
    }
  }, 30_000);

  it.each(["zh-CN", "en-US"])(
    "uses the SmartForm response language %s for grouped note labels and retains every question",
    async (locale) => {
      const questions = Array.from({ length: 12 }, (_, index) => ({
        id: `many-${index}`,
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        smartFormTargetLabel: "过时的中文行标题",
        body: `Original question ${index + 1}`,
        status: index === 0 ? "OPEN" : "REPLIED",
        createdAt: new Date(Date.UTC(2026, 8, 6, 3, index)),
        createdBy: { name: "Reviewer" },
        replyBody: `Original reply ${index + 1}`,
        repliedBy: { name: "Preparer" },
      }));
      const pdf = await new SmartFormV2PdfService().renderSmartFormV2Pdf({
        definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
        response: {
          ...DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
          responseLocale: locale,
        },
        reviewQuestions: [...questions].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        ),
      });
      const document = await PDFDocument.load(pdf);
      const notes = document.getPages().flatMap((page) => {
        const annotations = page.node.lookupMaybe(
          PDFName.of("Annots"),
          PDFArray
        );
        return annotations
          ? Array.from({ length: annotations.size() }, (_, index) =>
              annotations.lookup(index, PDFDict)
            ).filter((item) => item.has(PDFName.of("NM")))
          : [];
      });
      expect(notes).toHaveLength(1);
      const body = notes[0]
        .lookup(PDFName.of("Contents"), PDFHexString)
        .decodeText();
      const title = notes[0].lookup(PDFName.of("T"), PDFHexString).decodeText();
      expect(title).toBe(
        locale === "zh-CN"
          ? "复核注释 · 12 个问题"
          : "Review notes · 12 questions"
      );
      expect(body).toContain(
        locale === "zh-CN"
          ? "待回复 1 · 已回复 11"
          : "Awaiting reply 1 · Replied 11"
      );
      expect(body).not.toContain("过时的中文行标题");
      expect(body).toContain(
        locale === "zh-CN" ? "将本期数据" : "Compare the current figures"
      );
      for (let index = 1; index <= 12; index += 1) {
        expect(body).toContain(`Original question ${index}`);
        expect(body).toContain(`Original reply ${index}`);
      }
      expect(body.indexOf("Q1 ·")).toBeLessThan(body.indexOf("Q12 ·"));
    },
    30_000
  );

  it("keeps review anchors out of the document layout flow", async () => {
    const service = new SmartFormV2PdfService();
    const baseInput = {
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
      locale: "zh-CN",
    };
    const reviewQuestions = [
      {
        id: "layout-question",
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        body: "请解释本期余额变动并附上调节表。",
        status: "OPEN",
        createdAt: "2026-08-09T03:20:00.000Z",
        createdBy: { name: "Leo Li" },
      },
    ];
    const sourceWithoutQuestions = renderSmartFormV2TypstSource(baseInput);
    const sourceWithQuestions = renderSmartFormV2TypstSource({
      ...baseInput,
      reviewQuestions,
    });

    expect(sourceWithoutQuestions).not.toContain("smartform_review_anchor");
    expect(sourceWithQuestions).toContain(
      "#place(top + left)[#context { let p = here().position(); metadata((smartform_review_anchor: true"
    );

    const [baseDocument, annotatedDocument] = await Promise.all([
      service
        .renderSmartFormV2Pdf(baseInput)
        .then((pdf) => PDFDocument.load(pdf)),
      service
        .renderSmartFormV2Pdf({ ...baseInput, reviewQuestions })
        .then((pdf) => PDFDocument.load(pdf)),
    ]);
    expect(annotatedDocument.getPageCount()).toBe(baseDocument.getPageCount());
    expect(
      annotatedDocument.getPages().map((page) => page.getSize())
    ).toStrictEqual(baseDocument.getPages().map((page) => page.getSize()));

    const contents = annotatedDocument.getPages().flatMap((page) => {
      const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annotations) {
        return [];
      }
      return Array.from({ length: annotations.size() }, (_, index) => {
        const annotation = annotations.lookup(index, PDFDict);
        const id = annotation.lookupMaybe(PDFName.of("NM"), PDFHexString);
        return id?.decodeText() === "layout-question"
          ? annotation.lookup(PDFName.of("Contents"), PDFHexString).decodeText()
          : null;
      }).filter((value): value is string => Boolean(value));
    });
    expect(contents).toHaveLength(1);
    expect(contents[0]).toContain("Leo Li\n");
    expect(contents[0]).toContain("请解释本期余额变动并附上调节表。");
    expect(contents[0]).toContain("\n状态: 待回复");
  }, 30_000);
});
