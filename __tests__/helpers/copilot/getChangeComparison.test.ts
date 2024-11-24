import { getChangeComparison } from " @components/lib/utils/copilotHelpers";
import { IChange } from " @components/lib/utils/copilotPrompts";
import { INode } from " @components/types/INode";

const nodeData: INode = {
  deleted: false,
  specializations: [
    {
      nodes: [
        {
          id: "7J9DDHuX3XbuMAIeAUgP",
        },
        {
          id: "A1ZILJpCSQSbgAl9pl3E",
        },
      ],
      collectionName: "main",
    },
  ],
  generalizations: [
    {
      nodes: [
        {
          id: "Lr1tW0Vojyw0TjLgzITn",
        },
        {
          id: "zglq3VK5HR4qVMWMArTG",
        },
      ],
      collectionName: "main",
    },
  ],
  root: "hn9pGQNxmQe9Xod5MuKK",
  id: "00PiiAYFaG9Kukh2cQpB",
  createdBy: "user",
  unclassified: false,
  nodeType: "activity",
  title: "Sense chemicals",
  locked: false,
  textValue: {},
  propertyType: {
    actor: "actor",
    preConditions: "string-array",
    postConditions: "string-array",
    evaluationDimension: "evaluationDimension",
    description: "string",
    References: "string",
    "Objects Acted on": "object",
  },
  properties: {
    actor: [
      {
        nodes: [],
        collectionName: "main",
      },
    ],
    postConditions: ["condition2", "condition3"],
    preConditions: [],
    evaluationDimension: [
      {
        nodes: [],
        collectionName: "main",
      },
    ],
    parts: [
      {
        nodes: [
          {
            id: "JAOFbzkdC0jPv6EBddLu",
          },
          {
            id: "gufBgVJCuH2phuT5SkYe",
          },
          {
            id: "7WipWzYjpKMFZfkvGvVJ",
          },
        ],
        collectionName: "main",
      },
    ],
    description: "description",
    isPartOf: [
      {
        nodes: [],
        collectionName: "main",
      },
    ],
    References: "",
    "Objects Acted on": [
      {
        nodes: [],
        collectionName: "main",
      },
    ],
  },
  inheritance: {
    actor: {
      ref: "hn9pGQNxmQe9Xod5MuKK",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
    preConditions: {
      ref: "a09QmxjmXTabp0KD1Rub",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
    postConditions: {
      ref: "PciqSLSLeghAvIaYrKXA",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
    evaluationDimension: {
      ref: "hn9pGQNxmQe9Xod5MuKK",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
    parts: {
      ref: "fpGfqTlojpRssYzWPWar",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
    description: {
      ref: "fpGfqTlojpRssYzWPWar",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
    References: {
      inheritanceType: "inheritUnlessAlreadyOverRidden",
      ref: null,
    },
    "Objects Acted on": {
      ref: "hn9pGQNxmQe9Xod5MuKK",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
  },
};

describe("get improvement change values", () => {
  it("should make a correct comparison for specializations changes", () => {
    {
      const change: Partial<IChange> = {
        modified_property: "specializations",
        new_value: [
          {
            collectionName: "main",
            collection_changes: {
              nodes_to_add: ["nodeC"],
              nodes_to_delete: ["nodeB"],
              final_array: ["nodeC", "nodeD"],
            },
          },
          {
            collectionName: "collection2",
            collection_changes: {
              nodes_to_add: [],
              nodes_to_delete: [],
              final_array: [],
            },
          },
        ],
        reasoning: "",
      };

      const property = "specializations";
      const nodesByTitle = {
        nodeB: { id: "7J9DDHuX3XbuMAIeAUgP" },
        nodeC: { id: "id2" },
        nodeD: { id: "A1ZILJpCSQSbgAl9pl3E" },
      };
      const response = getChangeComparison({
        change,
        nodeData,
        nodesByTitle,
      }) as { addedCollections: string[]; result: any };

      expect(response.addedCollections).toEqual(["collection2"]);
      expect(response.result).toEqual([
        {
          collectionName: "main",
          nodes: [
            {
              id: "id2",
              change: "added",
            },
            {
              id: "A1ZILJpCSQSbgAl9pl3E",
            },
            {
              id: "7J9DDHuX3XbuMAIeAUgP",
              change: "removed",
            },
          ],
        },
        {
          collectionName: "collection2",
          nodes: [],
        },
      ]);
    }
  });
  it("should make a correct comparison for other structured properties changes. Example: parts...", () => {
    const change: Partial<IChange> = {
      modified_property: "parts",
      new_value: {
        nodes_to_add: ["nodeA"],
        nodes_to_delete: ["nodeB"],
        final_array: ["nodeA", "nodeC", "nodeD"],
      },
      reasoning: "",
    };
    const property = "parts";

    const nodesByTitle = {
      nodeA: { id: "id1" },
      nodeB: { id: "JAOFbzkdC0jPv6EBddLu" },
      nodeC: { id: "gufBgVJCuH2phuT5SkYe" },
      nodeD: { id: "7WipWzYjpKMFZfkvGvVJ" },
    };
    const response = getChangeComparison({
      change,
      nodeData,
      nodesByTitle,
    }) as { result: any };

    expect(response.result).toEqual([
      {
        collectionName: "main",
        nodes: [
          {
            id: "id1",
            change: "added",
          },
          {
            id: "gufBgVJCuH2phuT5SkYe",
          },
          {
            id: "7WipWzYjpKMFZfkvGvVJ",
          },
          {
            id: "JAOFbzkdC0jPv6EBddLu",
            change: "removed",
          },
        ],
      },
    ]);
  });

  it("should make a correct comparison for properties with type string-array. Example: postConditions, preConditions...", () => {
    const change: Partial<IChange> = {
      modified_property: "postConditions",
      new_value: {
        conditions_to_add: ["condition1"],
        conditions_to_delete: ["condition2"],
        final_array: ["condition1", "condition3"],
      },
      reasoning: "",
    };
    const property = "postConditions";

    const nodesByTitle = {};

    const response = getChangeComparison({
      change,
      nodeData,
      nodesByTitle,
    }) as { result: any };

    expect(response).toEqual({
      changeDetails: {
        addedElements: ["condition1"],
        removedElements: ["condition2"],
        newValue: ["condition1", "condition3"],
      },
    });
  });
  describe("compare string properties correctly like: description...", () => {
    it("should return the correct result when there is a change", () => {
      const change: Partial<IChange> = {
        modified_property: "description",
        new_value: "new description",
        reasoning: "",
      };
      const response: any = getChangeComparison({
        change,
        nodeData,
        nodesByTitle: {},
      });
      expect(response.changeDetails.newValue).toEqual("new description");
      expect(response.changeDetails.previousValue).toEqual("description");
    });

    it("should return null if there is no change", () => {
      const change: Partial<IChange> = {
        modified_property: "description",
        new_value: "description",
        reasoning: "",
      };
      const response: any = getChangeComparison({
        change,
        nodeData,
        nodesByTitle: {},
      });
      expect(response).toBeNull();
    });
  });
});
