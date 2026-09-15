import deployment from "../../../src/pages/api/deployment";

describe("public deployment identity", () => {
  const response = () => {
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
  };
  it("reports actual packaged v6/v7 manifests and the immutable commit", () => {
    const previous = process.env.SOURCE_COMMIT;
    process.env.SOURCE_COMMIT = "a".repeat(40);
    try {
      const res = response();
      deployment({ method: "GET" } as any, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      const info = res.json.mock.calls[0][0];
      expect(info.commit).toBe("a".repeat(40));
      expect(info.datasets).toEqual([
        expect.objectContaining({
          id: "ontology-title-testbed",
          cards: 18,
          current: false,
          version: "ontology-title-two-route-testbed-2026-09-02-v6",
          manifestSha256:
            "d37949667f4efce3d7a16fec9ec04c95774aea8789cedba4d8a19d3d753f91ea",
        }),
        expect.objectContaining({
          id: "ontology-title-testbed-v7",
          cards: 50,
          current: true,
          version: "ontology-title-random-round-2026-09-09-v7",
          manifestSha256:
            "d761c9729e79db44890d804c44df935a1972accb11d1870d8b90f37ba04eeded",
        }),
      ]);
      expect(info.packageSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(info.titlePromptStudy).toEqual(
        expect.objectContaining({
          version: "rob-simple-title-prompt-2026-09-13-development-v1",
          cases: 18,
          promptSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          bundleSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      expect(info.latestTitlePromptStudy).toEqual(
        expect.objectContaining({
          version: "rob-revised-title-prompt-2026-09-14-v3",
          cases: 18,
          promptSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          bundleSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      expect(Object.keys(info).sort()).toEqual([
        "buildId",
        "commit",
        "datasets",
        "latestTitlePromptStudy",
        "packageSha256",
        "revision",
        "titlePromptStudy",
      ]);
    } finally {
      if (previous === undefined) delete process.env.SOURCE_COMMIT;
      else process.env.SOURCE_COMMIT = previous;
    }
  });
  it("rejects mutation methods", () => {
    const res = response();
    deployment({ method: "POST" } as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
