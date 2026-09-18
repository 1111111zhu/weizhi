import { Tracking17TrackCarrierDirectoryService } from "./tracking-17track-carrier-directory.service";

describe(Tracking17TrackCarrierDirectoryService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, "fetch").mockImplementation(
      async (input: string | Request | URL) => {
        await Promise.resolve();
        const url = String(input);
        return {
          ok: true,
          status: 200,
          json: async () => {
            await Promise.resolve();
            return url.includes("additional_parameters")
              ? [
                  {
                    key: 100_003,
                    parameters: [
                      {
                        paramKey: "phone_number_last_4",
                        description: "phone_number_last_4",
                        sample: "8888",
                        require: true,
                      },
                    ],
                  },
                ]
              : [
                  {
                    key: 191_222,
                    _country_iso: "CN",
                    _name: "WHWDT",
                    "_name_zh-cn": "武汉沃德通",
                  },
                  {
                    key: 100_003,
                    _country_iso: "CN",
                    _name: "SF Express",
                    "_name_zh-cn": "顺丰速运",
                  },
                ];
          },
        } as unknown as Response;
      }
    );
  });

  it("allows phone verification while the carrier is auto detected", async () => {
    const service = new Tracking17TrackCarrierDirectoryService();
    await expect(
      service.validateQueryParameters(undefined, {
        phone_number_last_4: " 1234 ",
      })
    ).resolves.toStrictEqual({ phone_number_last_4: "1234" });
    await expect(
      service.validateQueryParameters(undefined, {
        phone_number_last_4: "12ab",
      })
    ).rejects.toThrow(
      "请填写四位数字的手机号后四位；其他查询信息需要选择运输商"
    );
    await expect(
      service.validateQueryParameters(undefined, { unexpected: "1234" })
    ).rejects.toThrow(
      "请填写四位数字的手机号后四位；其他查询信息需要选择运输商"
    );
  });

  it("searches the official carrier directory by Chinese name", async () => {
    const service = new Tracking17TrackCarrierDirectoryService();

    await expect(service.search("武汉")).resolves.toStrictEqual([
      {
        code: 191_222,
        countryIso: "CN",
        name: "WHWDT",
        nameZh: "武汉沃德通",
        requirements: [],
      },
    ]);
  });

  it("caches the carrier directory between searches", async () => {
    const service = new Tracking17TrackCarrierDirectoryService();

    await service.search("武汉");
    await service.search("顺丰");

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns and validates 17TRACK carrier-specific query requirements", async () => {
    const service = new Tracking17TrackCarrierDirectoryService();

    await expect(service.search("顺丰")).resolves.toStrictEqual([
      expect.objectContaining({
        code: 100_003,
        requirements: [
          expect.objectContaining({
            key: "phone_number_last_4",
            required: true,
          }),
        ],
      }),
    ]);
    await expect(service.validateQueryParameters(100_003, {})).rejects.toThrow(
      "phone_number_last_4"
    );
    await expect(
      service.validateQueryParameters(100_003, { phone_number_last_4: "1234" })
    ).resolves.toStrictEqual({ phone_number_last_4: "1234" });
  });
});
