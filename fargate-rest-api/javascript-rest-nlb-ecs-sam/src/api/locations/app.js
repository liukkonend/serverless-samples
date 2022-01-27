// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Implementation of the API backend for locations

const handlers = require('./handlers');
const express = require('express');
const bodyParser = require('body-parser');
const { metricScope, createMetricsLogger } = require("aws-embedded-metrics");
const AWSXRay = require("aws-xray-sdk");

// App
const app = express();
const jsonParser = bodyParser.json()

const logBusinessMetric = metricScope(metrics => function (req, res, next) {
    metrics.putMetric("ProcessedLocations", 1, "Count");
    metrics.setProperty("requestId", req.get('requestId'));
    metrics.setProperty('method', req.method);
    metrics.setProperty("routeKey", req.originalUrl);
    next();
});

app.use(AWSXRay.express.openSegment('locations-service'));

app.get('/health', (req, res) => {
    res.status(200).send('Ok');
});

app.get('/locations', logBusinessMetric, async (req, res, next) => {
    try {
        // Provided by the previous request to support pagination
        const { lastLocationID } = req.query;

        // Get locations
        const locations = await handlers.getLocations(lastLocationID);

        res.json(locations);
    }
    catch (err) {
        next(err)
    }
});

app.get('/locations/:locationID', logBusinessMetric, async (req, res, next) => { 
    try {
        const { locationID } = req.params;

        // Get location
        const location = await handlers.getLocation(locationID);

        res.json(location);
    }
    catch (err) {
        next(err)
    }
});

app.put('/locations/:locationID?', logBusinessMetric, jsonParser, async (req, res, next) => {
    try {
        const { locationID } = req.params;
        const { imageUrl, description, name } = req.body;

        // Create location
        const location = await handlers.upsertLocation(locationID, imageUrl, description, name);

        res.status(201).json(location);
    }
    catch (err) {
        next(err)
    }
});

app.delete('/locations/:locationID', logBusinessMetric, async (req, res, next) => {
    try {
        const { locationID } = req.params;

        // Delete location
        await handlers.deleteLocation(locationID);

        res.status(200).send();
    }
    catch (err) {
        next(err)
    }
});

app.use(AWSXRay.express.closeSegment());

app.use(function (err, req, res, next) {
    const metricsLogger = createMetricsLogger();
    metricsLogger.putMetric("LocationsErrors", 1, "Count");
    metricsLogger.setProperty("requestId", req.get('requestId'));
    metricsLogger.setProperty('method', req.method);
    metricsLogger.setProperty("routeKey", req.originalUrl);
    metricsLogger.flush();

    console.error(err.message);
    if (err instanceof handlers.ItemNotFoundError) {
        res.status(404).send(err.message);
    }
    else {
        res.status(500).send('Something broke!')
    }
  });

exports.app = app;