import type { TitlePromptStudyData } from "../../types/ITitlePromptStudy";
import { agentTraceForRecord } from "./agentTransparency";

/** Join archived displays only after checking source identity and every source line.
 * Neither archive nor the stored review responses are modified by this adapter.
 */
export function compareTitlePromptResults(
  data: TitlePromptStudyData,
  records: any[],
): TitlePromptStudyData {
  return {
    ...data,
    cases: data.cases.map((item) => {
      const sourceTitle = item.originalTitle || item.title;
      const matches = records.filter(
        (record) =>
          record.subject?.title === sourceTitle &&
          item.occurrenceIds?.includes(record.provenance?.sourceRecord),
      );
      const record = matches.length === 1 ? matches[0] : null;
      const context = record?.reviewerView?.context;
      const sameEvidence =
        context?.type === "title-split" &&
        context.currentTitle === sourceTitle &&
        context.linkedTasks?.length === item.descriptions.length &&
        item.descriptions.every(
          (source, index) =>
            source.number === index + 1 &&
            source.text === context.linkedTasks[index],
        );
      const validGroups =
        Array.isArray(context?.proposedNodes) &&
        context.proposedNodes.length > 0 &&
        context.proposedNodes.every(
          (node: any) =>
            typeof node.title === "string" &&
            Array.isArray(node.sourceTaskIndexes) &&
            node.sourceTaskIndexes.length > 0 &&
            node.sourceTaskIndexes.every(
              (number: number, index: number) =>
                Number.isInteger(number) &&
                number >= 1 &&
                number <= item.descriptions.length &&
                node.sourceTasks?.[index] ===
                  item.descriptions[number - 1].text,
            ),
        );
      if (!sameEvidence || !validGroups) {
        return {
          ...item,
          comparisonIssue:
            "A previous result with exactly matching source evidence is unavailable for this title.",
        };
      }
      return {
        ...item,
        previous: {
          groups: context.proposedNodes.map((node: any) => ({
            title: node.title,
            descriptionNumbers: [...node.sourceTaskIndexes],
            reason: node.reason || "",
          })),
          reason: record.reviewerView.reasoning || "",
          trace: agentTraceForRecord(record),
        },
      };
    }),
  };
}
