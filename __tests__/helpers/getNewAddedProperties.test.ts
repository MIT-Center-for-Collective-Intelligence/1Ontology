import { getNewAddedProperties } from " @components/lib/utils/helpers";
import { INode } from " @components/types/INode";

describe("getNewAddedProperties", () => {
  const mockNodes: any = {
    "1": {
      id: "1",
      title: "Parent Node",
      deleted: false,
      properties: {
        prop1: "value1",
        prop2: 100,
      },
      inheritance: {
        prop1: { ref: null, inheritanceType: "inheritUnlessAlreadyOverRidden" },
        prop2: { ref: null, inheritanceType: "inheritUnlessAlreadyOverRidden" },
      },
      specializations: [],
      generalizations: [],
      root: "rootNode",
      propertyType: { prop1: "string", prop2: "number" },
      nodeType: "activity",
      numberOfGeneralizations: 1,
      textValue: {},
      unclassified: false,
    },
    "2": {
      id: "2",
      title: "Specialized Node",
      deleted: false,
      properties: {
        prop2: 200, // This will override prop2 from generalization
      },
      inheritance: {
        prop2: { ref: null, inheritanceType: "inheritUnlessAlreadyOverRidden" },
      },
      specializations: [],
      generalizations: [],
      root: "rootNode",
      propertyType: { prop2: "number" },
      nodeType: "activity",
      numberOfGeneralizations: 1,
      textValue: {},
      unclassified: false,
    },
  };

  const mockSpecializationData: any = {
    id: "2",
    title: "Specialized Node",
    deleted: false,
    properties: {
      prop2: 200,
    },
    inheritance: {},
    specializations: [],
    generalizations: [],
    root: "rootNode",
    propertyType: { prop2: "number" },
    nodeType: "activity",
    numberOfGeneralizations: 1,
    textValue: {},
    unclassified: false,
  };

  const mockAddedLinks = [{ id: "1" }];

  it("should return new properties added from the generalization", () => {
    const result = getNewAddedProperties(
      mockAddedLinks,
      mockSpecializationData,
      mockNodes
    );

    expect(result).toEqual({
      "1": [
        {
          propertyName: "prop1",
          propertyType: "string",
          propertyValue: "value1",
        },
      ],
    });
  });

  it("should return an empty object if no properties are added", () => {
    const result = getNewAddedProperties([], mockSpecializationData, mockNodes);
    expect(result).toEqual({});
  });

  it("should return an empty object if specialization data is missing", () => {
    const result = getNewAddedProperties(
      mockAddedLinks,
      null as any,
      mockNodes
    );
    expect(result).toEqual({});
  });

  it("should skip properties that already exist in the specialization", () => {
    const mockSpecializationDataWithProp1 = {
      ...mockSpecializationData,
      properties: {
        prop1: "overriddenValue", // Overrides prop1
        prop2: 200,
      },
    };

    const result = getNewAddedProperties(
      mockAddedLinks,
      mockSpecializationDataWithProp1,
      mockNodes
    );

    expect(result).toEqual({});
  });

  it("should handle missing inheritance references gracefully", () => {
    const mockNodesWithInheritance: { [nodeId: string]: INode } = {
      ...mockNodes,
      "1": {
        ...mockNodes["1"],
        inheritance: {
          prop1: { ref: "someOtherNode", inheritanceType: "alwaysInherit" },
          prop2: { ref: null, inheritanceType: "alwaysInherit" },
        },
      },
    };

    const result = getNewAddedProperties(
      mockAddedLinks,
      mockSpecializationData,
      mockNodesWithInheritance
    );

    expect(result).toEqual({
      someOtherNode: [
        {
          propertyName: "prop1",
          propertyType: "string",
          propertyValue: "value1",
        },
      ],
    });
  });

  it("should handle errors gracefully and return an empty object", () => {
    // Simulate a case where an error is thrown inside the function
    jest.spyOn(console, "error").mockImplementation(() => {});

    const faultyNodes = null as any; // Intentionally causing an error
    const result = getNewAddedProperties(
      mockAddedLinks,
      mockSpecializationData,
      faultyNodes
    );

    expect(result).toEqual({});
    expect(console.error).toHaveBeenCalled();
  });
});
