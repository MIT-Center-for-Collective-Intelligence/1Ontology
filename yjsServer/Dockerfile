# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files to install dependencies
COPY package*.json ./

# Install the application dependencies
RUN npm install --only=production

# Copy the rest of the app's source code into the container
COPY . .

# Expose the port your app will run on (PORT 3000 is the default, overridden by Google Cloud Run)
EXPOSE 3000

# Command to run the app
CMD ["node", "server.js"]
