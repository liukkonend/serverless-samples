// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Implementation of the API backend for locations

const express = require('express');
const bodyParser = require('body-parser');
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { metricScope } = require("aws-embedded-metrics");
const AWSXRay = require("aws-xray-sdk");
const uuid = require("uuid");
const ddbClient = AWSXRay.captureAWSv3Client(new DynamoDB({}));

const dynamo = DynamoDBDocument.from(ddbClient);
const tableName = process.env.LOCATIONS_TABLE;

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

// App
const app = express();
const jsonParser = bodyParser.json()

app.use(AWSXRay.express.openSegment('locations-service'));

app.get('/health', (req, res) => {
  res.status(200).send('Ok');
});

app.get('/', metricScope(metrics => async (req, res) => {
  // console.log('Headers: ', req.headers);

  metrics.putDimensions({ Service: "Locations" });
  metrics.putMetric("ProcessedLocations", 1, "Count");
  metrics.setProperty("requestId", req.get('requestId'));
  metrics.setProperty("routeKey", "GET /locations");
  metrics.setProperty("Payload", { operation: 'GET'});

  const body = await dynamo.scan({ TableName: tableName });
  
  res.json({
    statusCode: 200,
    body
  });
}));

app.get('/:locationid', metricScope(metrics => async (req, res) => {
  const { locationid } = req.params;
  metrics.putDimensions({ Service: "Locations" });
  metrics.putMetric("ProcessedLocations", 1, "Count");
  metrics.setProperty("requestId", req.get('requestId'));
  metrics.setProperty("routeKey", "GET /locations/" + locationid);
  metrics.setProperty("Payload", { operation: 'GET', locationid });

  const body = await dynamo.get({ TableName: tableName, Key: { locationid }});
  
  res.json({
    statusCode: 200,
    body
  });
}));

app.post('/', jsonParser, metricScope(metrics => async (req, res) => {
  const { imageUrl, description, name } = req.body;

  const newitem = {
    locationid: uuid.v1(),
    timestamp: new Date().toISOString(),
    description,
    imageUrl,
    name
  };

  console.log(newitem);

  metrics.putDimensions({ Service: "Locations" });
  metrics.putMetric("ProcessedLocations", 1, "Count");
  metrics.setProperty("requestId", req.get('requestId'));
  metrics.setProperty("routeKey", "POST /locations");
  metrics.setProperty("Payload", { operation: 'POST' });

  try {
    const body = await dynamo.put({ TableName: tableName, Item: newitem });
    res.json({
      statusCode: 200,
      body
    });
  }
  catch (err) {
    console.error(err.message);
    res.status(500).send('Error!');
  }
}));

app.use(AWSXRay.express.closeSegment());

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);