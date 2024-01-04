// Import the axios library for making HTTP requests
import axios from "axios";

// Function to extract error messages from the Axios error object
function getErrorMessage(error: any) {
  const response = error.response;

  // If there's no response object, return the original error
  if (!response) return error;

  // If the HTTP status code is 418 (I'm a teapot), return the original error
  if (response.status === 418) return error;

  // Initialize an empty error message string
  let errorMessage = "";

  // Extract the 'data' property from the response
  const { data } = response;

  // If there is data in the response, append message-related information to errorMessage
  if (data) {
    // Append 'message' property if available
    errorMessage += data.message ? data.message : "";

    // Append 'errorMessage' property if available
    errorMessage += data.errorMessage ? data.errorMessage : "";

    // If there's an 'error' property in the data, log it to the console
    if (data.error) {
      console.error(data.error);
    }
  }

  // Return the composed error message
  return errorMessage;
}

// Create an instance of axios with custom configuration (headers in this case)
const adapter = axios.create({
  headers: {
    Accept: "application/json",
  },
});

// Add an interceptor to handle responses
adapter.interceptors.response.use(
  // If the response status is greater than 399 (error range), reject the promise
  response => {
    if (response.status > 399) {
      return Promise.reject(response);
    }
    // If the response status is within the success range, resolve the promise with the response
    return response;
  },
  // If there's an error, call the getErrorMessage function and reject the promise with the error message
  error => {
    const errorMessage = getErrorMessage(error);
    return Promise.reject(errorMessage);
  }
);

// Export the axios instance with the added configurations and interceptors
export default adapter;
