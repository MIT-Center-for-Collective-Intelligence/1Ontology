import { Post } from "./Post";
import { recordLogs } from "./helpers";

export const sendLLMRequest = async (
  userMessage: string,
  model: string,
  deepNumber: number,
  nodeId: string
) => {
  try {
    const response = await Post("/copilot", {
      userMessage,
      model,
      deepNumber,
      nodeId,
    });
    recordLogs({
      reason: "sendLLMRequest",
      response,
    });
    return response;
  } catch (error) {
    console.error("Error making request:", error);
    throw error;
  }
};
