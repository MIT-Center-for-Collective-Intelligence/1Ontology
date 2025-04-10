#!/bin/bash

# Set variables for project ID, app name, and repository
PROJECT_ID="ontology-41607"
IMAGE_NAME="ontology-app"
REGION="us-central1"
REPO_NAME="ontology"
TIMEOUT="2000s"

# Authenticate with Google Cloud
#gcloud auth login
gcloud config set project $PROJECT_ID

# Build the Docker image
docker build -t $IMAGE_NAME .

# Tag the Docker image for Artifact Registry
docker tag $IMAGE_NAME $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME

# Push the image to Artifact Registry
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME

# Deploy to Google Cloud Run
gcloud run deploy $IMAGE_NAME \
   --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME \
   --platform managed \
   --region $REGION \
   --allow-unauthenticated \
   --timeout $TIMEOUT
