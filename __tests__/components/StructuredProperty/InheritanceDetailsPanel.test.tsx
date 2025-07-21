import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

export interface NumericValue {
  value: number | string;
  unit: string;
}

export interface InheritanceSource {
  nodeId: string;
  nodeTitle: string;
  value: any;
  isInherited: boolean;
  inheritedFrom?: string;
}

export interface InheritanceDetailsData {
  hasMultipleGeneralizations: boolean;
  inheritanceSources: InheritanceSource[];
  aggregatedValue?: any;
  propertyType?: "string" | "string-array" | "collection" | "numeric";
  isNumeric?: boolean;
  isMultiLine?: boolean;
}

interface MockNode {
  id: string;
  title: string;
  properties: { [key: string]: any };
  inheritance: { [key: string]: { ref?: string } };
  propertyType: { [key: string]: string };
  generalizations?: Array<{ nodes: Array<{ id: string }> }>;
}

interface MockNodes {   
  [id: string]: MockNode;
}

const parseNumericValue = (val: any): NumericValue => {
  if (typeof val === 'object' && val !== null && 'value' in val) {
    return {
      value: val.value || '',
      unit: val.unit || '',
    };
  }
  return {
    value: val || '',
    unit: '',
  };
};

const formatNumericDisplay = (val: NumericValue): string => {
  if (!val.value && !val.unit) return "No value";
  return `${val.value}${val.unit ? ` ${val.unit}` : ''}`;
};

const createInheritanceData = (
  currentVisibleNode: MockNode,
  nodes: MockNodes,
  property: string
): InheritanceDetailsData => {
  const generalizationNodes =
    currentVisibleNode.generalizations?.flatMap(
      (collection: { nodes: any[] }) =>
        collection.nodes.map((node: { id: any }) => node.id),
    ) || [];

  if (generalizationNodes.length === 0) {
    return {
      hasMultipleGeneralizations: false,
      inheritanceSources: [],
      aggregatedValue: currentVisibleNode.properties[property],
    };
  }

  const resolvePropertyValue = (
    nodeId: string,
    propertyName: string,
  ): any => {
    const node = nodes[nodeId];
    if (!node) return getDefaultValue();

    if (
      node.properties[propertyName] !== undefined &&
      node.properties[propertyName] !== null &&
      node.properties[propertyName] !== ""
    ) {
      return node.properties[propertyName];
    }

    const inheritanceRef = node.inheritance[propertyName]?.ref;
    if (inheritanceRef && nodes[inheritanceRef]) {
      return resolvePropertyValue(inheritanceRef, propertyName);
    }

    return getDefaultValue();
  };

  const getDefaultValue = () => {
    const propertyType = currentVisibleNode.propertyType[property];
    if (propertyType === "numeric") return { value: 0, unit: '' };
    if (propertyType === "string-array") return [];
    if (Array.isArray(currentVisibleNode.properties[property])) return [];
    return "";
  };

  const inheritanceSources = generalizationNodes
    .map((nodeId: string) => {
      const node = nodes[nodeId];
      if (!node) return null;

      let actualValue = resolvePropertyValue(nodeId, property);
      let inheritedFromTitle = undefined;

      if (node.inheritance[property]?.ref) {
        inheritedFromTitle = nodes[node.inheritance[property].ref]?.title;
        actualValue = resolvePropertyValue(
          node.inheritance[property].ref,
          property,
        );
      }

      return {
        nodeId,
        nodeTitle: node.title || "Unknown",
        value: actualValue,
        isInherited: !!node.inheritance[property]?.ref,
        inheritedFrom: inheritedFromTitle,
      };
    })
    .filter((source: any) => source !== null && nodes[source.nodeId]) as InheritanceSource[];

  if (inheritanceSources.length === 0) {
    return {
      hasMultipleGeneralizations: false,
      inheritanceSources: [],
      aggregatedValue: currentVisibleNode.properties[property],
    };
  }

  const propertyType = currentVisibleNode.propertyType[property];
  const firstValue = inheritanceSources[0]?.value;

  const isNumeric =
    propertyType === "numeric" ||
    typeof firstValue === "number" ||
    (typeof firstValue === "object" && firstValue !== null && 'value' in firstValue) ||
    (!isNaN(Number(firstValue)) &&
      firstValue !== "" &&
      typeof firstValue === "string");

  const isMultiLine =
    propertyType === "text" ||
    property === "description" ||
    (typeof firstValue === "string" &&
      (firstValue.includes("\n") || firstValue.length > 100));

  let aggregatedValue = currentVisibleNode.properties[property];

  if (
    currentVisibleNode.inheritance[property]?.ref &&
    inheritanceSources.length > 0
  ) {
    if (isNumeric) {
      if (propertyType === "numeric") {
        const firstSource = inheritanceSources[0];
        const parsedValue = parseNumericValue(firstSource.value);
        
        for (let i = 1; i < inheritanceSources.length; i++) {
          const otherValue = parseNumericValue(inheritanceSources[i].value);
          if (otherValue.unit && !parsedValue.unit) {
            parsedValue.unit = otherValue.unit;
          }
        }
        
        aggregatedValue = parsedValue;
      } else {
        aggregatedValue = inheritanceSources[0].value;
      }
    } else if (propertyType === "string-array") {
      const allItems = inheritanceSources.flatMap((source) =>
        Array.isArray(source.value) ? source.value : [],
      );
      aggregatedValue = [...new Set(allItems)];
    } else if (isMultiLine) {
      const textValues = inheritanceSources
        .map((source) => String(source.value))
        .filter((val: string) => val && val.trim());
      aggregatedValue = textValues.join("\n##########\n");
    } else {
      const textValues = inheritanceSources
        .map((source) => String(source.value))
        .filter((val: string) => val && val.trim());
      aggregatedValue = textValues.join(" ########## ");
    }
  }

  return {
    hasMultipleGeneralizations: inheritanceSources.length > 1,
    aggregatedValue,
    inheritanceSources,
    propertyType: propertyType as "string" | "numeric" | "string-array" | "collection" | undefined,
    isNumeric,
    isMultiLine,
  };
};

describe("InheritanceDetailsPanel Logic", () => {
  describe("parseNumericValue function", () => {
    it("should parse numeric object with value and unit", () => {
      const input = { value: 25, unit: "kg" };
      const result = parseNumericValue(input);
      expect(result).toEqual({ value: 25, unit: "kg" });
    });

    it("should parse numeric object with missing unit", () => {
      const input = { value: 100 };
      const result = parseNumericValue(input);
      expect(result).toEqual({ value: 100, unit: "" });
    });

    it("should parse simple numeric value", () => {
      const input = 42;
      const result = parseNumericValue(input);
      expect(result).toEqual({ value: 42, unit: "" });
    });

    it("should parse string value", () => {
      const input = "test value";
      const result = parseNumericValue(input);
      expect(result).toEqual({ value: "test value", unit: "" });
    });

    it("should handle null and undefined", () => {
      expect(parseNumericValue(null)).toEqual({ value: "", unit: "" });
      expect(parseNumericValue(undefined)).toEqual({ value: "", unit: "" });
    });
  });

  describe("formatNumericDisplay function", () => {
    it("should format value with unit", () => {
      const input = { value: 25, unit: "kg" };
      const result = formatNumericDisplay(input);
      expect(result).toBe("25 kg");
    });

    it("should format value without unit", () => {
      const input = { value: 100, unit: "" };
      const result = formatNumericDisplay(input);
      expect(result).toBe("100");
    });

    it("should handle empty value", () => {
      const input = { value: "", unit: "" };
      const result = formatNumericDisplay(input);
      expect(result).toBe("No value");
    });

    it("should handle zero value", () => {
      const input = { value: 0, unit: "meters" };
      const result = formatNumericDisplay(input);
      expect(result).toBe("0 meters");
    });
  });

  describe("Basic inheritance detection", () => {
    it("should return no inheritance data when node has no generalizations", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Local description" },
        inheritance: {},
        propertyType: { description: "string" },
        generalizations: [],
      };

      const nodes: MockNodes = {};
      const property = "description";

      const result = createInheritanceData(currentNode, nodes, property);

      expect(result).toEqual({
        hasMultipleGeneralizations: false,
        inheritanceSources: [],
        aggregatedValue: "Local description",
      });
    });

    it("should detect single generalization", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Local description" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent Node",
          properties: { description: "Parent description" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const property = "description";
      const result = createInheritanceData(currentNode, nodes, property);

      expect(result.hasMultipleGeneralizations).toBe(false);
      expect(result.inheritanceSources).toHaveLength(1);
    });

    it("should detect multiple generalizations requiring inheritance details", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Local description" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "Description from parent 1" },
          inheritance: {},
          propertyType: { description: "string" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { description: "Description from parent 2" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const property = "description";
      const result = createInheritanceData(currentNode, nodes, property);

      expect(result.hasMultipleGeneralizations).toBe(true);
      expect(result.inheritanceSources).toHaveLength(2);
      expect(result.inheritanceSources[0]).toEqual({
        nodeId: "parent1",
        nodeTitle: "Parent One",
        value: "Description from parent 1",
        isInherited: false,
        inheritedFrom: undefined,
      });
      expect(result.inheritanceSources[1]).toEqual({
        nodeId: "parent2",
        nodeTitle: "Parent Two",
        value: "Description from parent 2",
        isInherited: false,
        inheritedFrom: undefined,
      });
    });
  });

  describe("Property type handling", () => {
    it("should handle numeric properties with units correctly", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { weight: { value: 85, unit: "kg" } },
        inheritance: { weight: { ref: "parent1" } },
        propertyType: { weight: "numeric" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { weight: { value: 90, unit: "kg" } },
          inheritance: {},
          propertyType: { weight: "numeric" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { weight: { value: 75, unit: "lb" } },
          inheritance: {},
          propertyType: { weight: "numeric" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "weight");

      expect(result.isNumeric).toBe(true);
      expect(result.aggregatedValue).toEqual({ value: 90, unit: "kg" });
      expect(result.inheritanceSources[0].value).toEqual({ value: 90, unit: "kg" });
      expect(result.inheritanceSources[1].value).toEqual({ value: 75, unit: "lb" });
    });

    it("should preserve units when aggregating numeric values", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { height: { value: 0, unit: "" } },
        inheritance: { height: { ref: "parent1" } },
        propertyType: { height: "numeric" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { height: { value: 180, unit: "" } },
          inheritance: {},
          propertyType: { height: "numeric" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { height: { value: 175, unit: "cm" } },
          inheritance: {},
          propertyType: { height: "numeric" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "height");

      expect(result.aggregatedValue.unit).toBe("cm");
    });

    it("should handle collection properties", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { items: [{ nodes: [{ id: "item1" }] }] },
        inheritance: { items: { ref: "parent1" } },
        propertyType: { items: "collection" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { items: [{ nodes: [{ id: "item1" }, { id: "item2" }] }] },
          inheritance: {},
          propertyType: { items: "collection" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { items: [{ nodes: [{ id: "item3" }] }] },
          inheritance: {},
          propertyType: { items: "collection" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "items");

      expect(result.propertyType).toBe("collection");
      expect(result.inheritanceSources[0].value).toEqual([{ nodes: [{ id: "item1" }, { id: "item2" }] }]);
      expect(result.inheritanceSources[1].value).toEqual([{ nodes: [{ id: "item3" }] }]);
    });

    it("should handle string-array properties with deduplication", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { tags: ["tag1"] },
        inheritance: { tags: { ref: "parent1" } },
        propertyType: { tags: "string-array" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { tags: ["tag1", "tag2"] },
          inheritance: {},
          propertyType: { tags: "string-array" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { tags: ["tag2", "tag3"] },
          inheritance: {},
          propertyType: { tags: "string-array" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "tags");

      expect(result.aggregatedValue).toEqual(["tag1", "tag2", "tag3"]);
      expect(result.inheritanceSources[0].value).toEqual(["tag1", "tag2"]);
      expect(result.inheritanceSources[1].value).toEqual(["tag2", "tag3"]);
    });

    it("should handle text properties with concatenation", () => {
      const longDescription = "This is a very long description that exceeds the 100 character limit for determining if text should be treated as multi-line content";
      
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Local description" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "text" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: longDescription },
          inheritance: {},
          propertyType: { description: "text" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { description: "Short description from parent 2" },
          inheritance: {},
          propertyType: { description: "text" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      expect(result.isMultiLine).toBe(true);
      expect(result.aggregatedValue).toBe(
        `${longDescription}\n##########\nShort description from parent 2`
      );
    });
  });

  describe("Deep inheritance chains", () => {
    it("should resolve values through inheritance chains", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "" },
          inheritance: { description: { ref: "grandparent1" } },
          propertyType: { description: "string" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { description: "Direct value from parent 2" },
          inheritance: {},
          propertyType: { description: "string" },
        },
        grandparent1: {
          id: "grandparent1",
          title: "Grandparent One",
          properties: { description: "Value from grandparent" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      expect(result.inheritanceSources[0]).toEqual({
        nodeId: "parent1",
        nodeTitle: "Parent One",
        value: "Value from grandparent",
        isInherited: true,
        inheritedFrom: "Grandparent One",
      });
      expect(result.inheritanceSources[1]).toEqual({
        nodeId: "parent2",
        nodeTitle: "Parent Two",
        value: "Direct value from parent 2",
        isInherited: false,
        inheritedFrom: undefined,
      });
    });

    it("should handle broken inheritance chains gracefully", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "" },
          inheritance: { description: { ref: "missing-node" } },
          propertyType: { description: "string" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { description: "Valid description" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      expect(result.inheritanceSources[0].value).toBe("");
      expect(result.inheritanceSources[1].value).toBe("Valid description");
    });
  });

  describe("Default value handling", () => {
    it("should provide correct default values for different property types", () => {
      const testCases = [
        { propertyType: "numeric", expectedDefault: { value: 0, unit: '' } },
        { propertyType: "string-array", expectedDefault: [] },
        { propertyType: "string", expectedDefault: "" },
      ];

      testCases.forEach(({ propertyType, expectedDefault }) => {
        const currentNode: MockNode = {
          id: "node1",
          title: "Test Node",
          properties: { testProp: null },
          inheritance: { testProp: { ref: "parent1" } },
          propertyType: { testProp: propertyType },
          generalizations: [{ nodes: [{ id: "parent1" }] }],
        };

        const nodes: MockNodes = {
          parent1: {
            id: "parent1",
            title: "Parent One",
            properties: { testProp: null },
            inheritance: {},
            propertyType: { testProp: propertyType },
          },
        };

        const result = createInheritanceData(currentNode, nodes, "testProp");

        expect(result.inheritanceSources[0].value).toEqual(expectedDefault);
      });
    });
  });

  describe("Property type detection", () => {
    it("should detect numeric properties from object structure", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { score: { value: 85, unit: "%" } },
        inheritance: {},
        propertyType: {},
        generalizations: [{ nodes: [{ id: "parent1" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { score: { value: 90, unit: "%" } },
          inheritance: {},
          propertyType: {},
        },
      };

      const result = createInheritanceData(currentNode, nodes, "score");

      expect(result.isNumeric).toBe(true);
    });

    it("should detect multi-line text from content", () => {
      const multiLineText = "Line 1\nLine 2\nLine 3";
      
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { content: multiLineText },
        inheritance: {},
        propertyType: {},
        generalizations: [{ nodes: [{ id: "parent1" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { content: multiLineText },
          inheritance: {},
          propertyType: {},
        },
      };

      const result = createInheritanceData(currentNode, nodes, "content");

      expect(result.isMultiLine).toBe(true);
    });

    it("should detect description property as multi-line", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Short description" },
        inheritance: {},
        propertyType: {},
        generalizations: [{ nodes: [{ id: "parent1" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "Another description" },
          inheritance: {},
          propertyType: {},
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      expect(result.isMultiLine).toBe(true);
    });
  });

  describe("Panel visibility conditions", () => {
    it("should not show panel when no inheritance reference exists", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Local description" },
        inheritance: {},
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "Description from parent 1" },
          inheritance: {},
          propertyType: { description: "string" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { description: "Description from parent 2" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      const shouldShowPanel = result.hasMultipleGeneralizations && !!currentNode.inheritance["description"]?.ref;
      expect(shouldShowPanel).toBe(false);
    });

    it("should show panel when multiple generalizations exist with inheritance reference", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Local description" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "Description from parent 1" },
          inheritance: {},
          propertyType: { description: "string" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { description: "Description from parent 2" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      const shouldShowPanel = result.hasMultipleGeneralizations && !!currentNode.inheritance["description"]?.ref;
      expect(shouldShowPanel).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle missing nodes in generalizations", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "Local description" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "missing-parent" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "Description from parent 1" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      expect(result.inheritanceSources).toHaveLength(1);
      expect(result.inheritanceSources[0].nodeId).toBe("parent1");
    });

    it("should handle empty property values correctly", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { description: "" },
        inheritance: { description: { ref: "parent1" } },
        propertyType: { description: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { description: "" },
          inheritance: {},
          propertyType: { description: "string" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { description: "Non-empty description" },
          inheritance: {},
          propertyType: { description: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "description");

      expect(result.inheritanceSources[0].value).toBe("");
      expect(result.inheritanceSources[1].value).toBe("Non-empty description");
      expect(result.aggregatedValue).toBe("Non-empty description");
    });

    it("should handle nodes without required properties", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: {},
        inheritance: {},
        propertyType: { newProp: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: {},
          inheritance: {},
          propertyType: {},
        },
      };

      const result = createInheritanceData(currentNode, nodes, "newProp");

      expect(result.inheritanceSources[0].value).toBe("");
    });

    it("should handle complex numeric objects in inheritance chains", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { measurement: { value: 0, unit: "" } },
        inheritance: { measurement: { ref: "parent1" } },
        propertyType: { measurement: "numeric" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { measurement: { value: "", unit: "" } },
          inheritance: { measurement: { ref: "grandparent1" } },
          propertyType: { measurement: "numeric" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { measurement: { value: 50, unit: "cm" } },
          inheritance: {},
          propertyType: { measurement: "numeric" },
        },
        grandparent1: {
          id: "grandparent1",
          title: "Grandparent One",
          properties: { measurement: { value: 100, unit: "mm" } },
          inheritance: {},
          propertyType: { measurement: "numeric" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "measurement");

      expect(result.inheritanceSources[0].value).toEqual({ value: 100, unit: "mm" });
      expect(result.inheritanceSources[0].isInherited).toBe(true);
      expect(result.inheritanceSources[0].inheritedFrom).toBe("Grandparent One");
    });

    it("should filter out empty text values in aggregation", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { notes: "" },
        inheritance: { notes: { ref: "parent1" } },
        propertyType: { notes: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }, { id: "parent3" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { notes: "" },
          inheritance: {},
          propertyType: { notes: "string" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { notes: "Valid note" },
          inheritance: {},
          propertyType: { notes: "string" },
        },
        parent3: {
          id: "parent3",
          title: "Parent Three",
          properties: { notes: "   " },
          inheritance: {},
          propertyType: { notes: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "notes");

      expect(result.aggregatedValue).toBe("Valid note");
    });
  });

  describe("Aggregation behavior", () => {
    it("should prioritize first source for numeric aggregation", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { score: { value: 0, unit: "" } },
        inheritance: { score: { ref: "parent1" } },
        propertyType: { score: "numeric" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { score: { value: 85, unit: "%" } },
          inheritance: {},
          propertyType: { score: "numeric" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { score: { value: 92, unit: "%" } },
          inheritance: {},
          propertyType: { score: "numeric" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "score");

      expect(result.aggregatedValue).toEqual({ value: 85, unit: "%" });
    });

    it("should combine array values and deduplicate", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { skills: [] },
        inheritance: { skills: { ref: "parent1" } },
        propertyType: { skills: "string-array" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }, { id: "parent3" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { skills: ["JavaScript", "React"] },
          inheritance: {},
          propertyType: { skills: "string-array" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { skills: ["React", "TypeScript"] },
          inheritance: {},
          propertyType: { skills: "string-array" },
        },
        parent3: {
          id: "parent3",
          title: "Parent Three",
          properties: { skills: ["Python", "JavaScript"] },
          inheritance: {},
          propertyType: { skills: "string-array" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "skills");

      expect(result.aggregatedValue).toEqual(["JavaScript", "React", "TypeScript", "Python"]);
    });

    it("should handle mixed empty and non-empty arrays", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { categories: [] },
        inheritance: { categories: { ref: "parent1" } },
        propertyType: { categories: "string-array" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { categories: [] },
          inheritance: {},
          propertyType: { categories: "string-array" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { categories: ["tech", "education"] },
          inheritance: {},
          propertyType: { categories: "string-array" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "categories");

      expect(result.aggregatedValue).toEqual(["tech", "education"]);
    });
  });

  describe("Complex inheritance scenarios", () => {
    it("should handle multiple levels of inheritance with unit preservation", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { dimension: { value: 0, unit: "" } },
        inheritance: { dimension: { ref: "parent1" } },
        propertyType: { dimension: "numeric" },
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { dimension: { value: 100, unit: "" } },
          inheritance: {},
          propertyType: { dimension: "numeric" },
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { dimension: { value: 200, unit: "px" } },
          inheritance: {},
          propertyType: { dimension: "numeric" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "dimension");

      expect(result.aggregatedValue.value).toBe(100);
      expect(result.aggregatedValue.unit).toBe("px");
    });

    it("should handle mixed property types gracefully", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { mixedProp: "string value" },
        inheritance: { mixedProp: { ref: "parent1" } },
        propertyType: {},
        generalizations: [{ nodes: [{ id: "parent1" }, { id: "parent2" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { mixedProp: 42 },
          inheritance: {},
          propertyType: {},
        },
        parent2: {
          id: "parent2",
          title: "Parent Two",
          properties: { mixedProp: ["array", "value"] },
          inheritance: {},
          propertyType: {},
        },
      };

      const result = createInheritanceData(currentNode, nodes, "mixedProp");

      expect(result.isNumeric).toBe(true);
      expect(result.aggregatedValue).toBe(42);
    });

    it("should handle circular inheritance references", () => {
      const currentNode: MockNode = {
        id: "node1",
        title: "Test Node",
        properties: { circularProp: "" },
        inheritance: { circularProp: { ref: "parent1" } },
        propertyType: { circularProp: "string" },
        generalizations: [{ nodes: [{ id: "parent1" }] }],
      };

      const nodes: MockNodes = {
        parent1: {
          id: "parent1",
          title: "Parent One",
          properties: { circularProp: "" },
          inheritance: { circularProp: { ref: "node1" } },
          propertyType: { circularProp: "string" },
        },
      };

      const result = createInheritanceData(currentNode, nodes, "circularProp");

      expect(result.inheritanceSources[0].value).toBe("");
    });
  });
});