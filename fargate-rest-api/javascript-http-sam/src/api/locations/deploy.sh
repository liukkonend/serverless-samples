#!/bin/bash

echo Logging in to Amazon ECR...
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 662754177324.dkr.ecr.us-east-1.amazonaws.com
REPOSITORY_URI=662754177324.dkr.ecr.us-east-1.amazonaws.com/locations-service-repository
VERSION=1.0.0

echo Build started on `date`
echo Building the Docker image...
docker build -t $REPOSITORY_URI:latest .
docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$VERSION

echo Build completed on `date`
echo Pushing the Docker images...
docker push $REPOSITORY_URI:latest
docker push $REPOSITORY_URI:$VERSION