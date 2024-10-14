import { compareProperties } from " @components/lib/utils/helpersCopilot";
import { getDocs, query, where, collection } from "firebase/firestore";

// Mock Firebase Firestore functions
jest.mock("firebase/firestore", () => ({
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  collection: jest.fn(),
}));

describe("compareProperties", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const nodeProps = {
    title: "Destroy",
    description: "Destroy a physical object",
    specializations: [
      {
        collectionName: "Destroy what?",
        nodes: [{ id: "node1" }, { id: "node2" }],
      },
    ],
    generalizations: [
      {
        collectionName: "main",
        nodes: [{ id: "node3" }],
      },
    ],
  };

  const improvementProps = {
    old_title: "Destroy",
    new_title: "Destroy",
    nodeType: "activity",
    description: "An updated description for destroy.",
    specializations: [
      {
        collection: "Destroy what?",
        nodes: ["Destroy information", "Destroy physical object"],
      },
    ],
    generalizations: [
      {
        collection: "main",
        nodes: ['Act (or "Process")'],
      },
    ],
  };

  it("should detect changes in string properties", async () => {
    const result = await compareProperties(
      nodeProps,
      improvementProps,
      improvementProps
    );

    expect(result).toEqual([
      {
        modifiedProperty: "description",
        previousValue: "Destroy a physical object",
        newValue: "An updated description for destroy.",
      },
    ]);
  });

  it("should detect changes in array properties (additions)", async () => {
    // Mocking getNodeIdByTitle to return ids for titles
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [{ id: "node4", data: () => ({ title: "Destroy information" }) }],
    });

    const result = await compareProperties(
      nodeProps,
      improvementProps,
      improvementProps
    );

    expect(result).toEqual([
      {
        modifiedProperty: "description",
        previousValue: "Destroy a physical object",
        newValue: "An updated description for destroy.",
      },
      {
        modifiedProperty: "specializations",
        previousValue: nodeProps.specializations,
        newValue: improvementProps.specializations,
      },
    ]);
  });

  it("should detect no changes when properties are the same", async () => {
    const result = await compareProperties(nodeProps, nodeProps, nodeProps);

    expect(result).toEqual([]);
  });

  it("should handle empty node properties gracefully", async () => {
    const emptyNodeProps = {};
    const result = await compareProperties(
      emptyNodeProps,
      improvementProps,
      improvementProps
    );

    expect(result).toEqual([]);
  });

  it("should detect removed properties", async () => {
    const modifiedNodeProps: any = { ...nodeProps };
    delete modifiedNodeProps["description"];

    const result = await compareProperties(
      modifiedNodeProps,
      improvementProps,
      improvementProps
    );

    expect(result).toEqual([
      {
        modifiedProperty: "description",
        previousValue: undefined,
        newValue: "An updated description for destroy.",
      },
    ]);
  });
});
