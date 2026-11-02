import { createContext, useContext } from "react";
import { Insert } from "./FlowGenerator";

/** Lets nodes and edges deep inside React Flow reach the editor's handlers. */
export type FlowEditContextValue = {
  editing: boolean;
  /** A "+" was clicked; `anchor` positions the kind menu. */
  onInsert: (insert: Insert, anchor: HTMLElement) => void;
};

export const FlowEditContext = createContext<FlowEditContextValue>({
  editing: false,
  onInsert: () => {},
});

export const useFlowEdit = () => useContext(FlowEditContext);
