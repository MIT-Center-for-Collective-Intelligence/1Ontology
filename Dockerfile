# Use Node.js image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy project files
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Start the app
CMD ["npm", "start"]