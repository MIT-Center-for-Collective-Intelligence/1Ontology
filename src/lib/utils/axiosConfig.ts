import axios from "axios";

export function getErrorMessage(error: any) {
  const response = error.response;
  if (!response) return error;
  if (response.status === 418) return error;
  const { data } = response;
  if (!data) return error;
  if (data.error) {
    console.error(data.error);
  }
  const errorMessage = [data.message, data.errorMessage, data.error]
    .filter((message) => typeof message === "string" && message.trim())
    .join(" ");
  return errorMessage || error;
}
const adapter = axios.create({
  headers: {
    Accept: "application/json",
    withCredentials: false,
  },
});

adapter.interceptors.response.use(
  (response) => {
    if (response.status > 399) {
      return Promise.reject(response);
    }
    return response;
  },
  (error) => {
    const errorMessage = getErrorMessage(error);
    return Promise.reject(errorMessage);
  },
);

export default adapter;
