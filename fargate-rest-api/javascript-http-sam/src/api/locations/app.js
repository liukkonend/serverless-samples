// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Implementation of the API backend for locations

const handlers = require('./handlers');
const express = require('express');
const bodyParser = require('body-parser');
const { metricScope } = require("aws-embedded-metrics");
const AWSXRay = require("aws-xray-sdk");

// App
const app = express();
const jsonParser = bodyParser.json()

const emf = metricScope(metrics => function (req, res, next) {
    metrics.putDimensions({ Service: "Locations" });
    metrics.putMetric("ProcessedLocations", 1, "Count");
    metrics.setProperty("requestId", req.get('requestId'));
    metrics.setProperty("routeKey", req.baseUrl);
    res.locals.metrics = metrics;
    next();
});

app.use(AWSXRay.express.openSegment('locations-service'));

app.get('/health', (req, res) => {
    res.status(200).send('Ok');
});

app.get('/', emf, async (req, res, next) => {
    try {
        // Get locations
        const locations = await handlers.getLocations();

        // Update metrics
        res.locals.metrics.setProperty("Payload", { operation: 'GET'});

        res.json(locations);
    }
    catch (err) {
        next(err)
    }
});

app.get('/:locationid', emf, async (req, res, next) => { 
    try {
        const { locationid } = req.params;

        // Get locations
        const location = await handlers.getLocation(locationid);

        // Update metrics
        res.locals.metrics.setProperty("Payload", { operation: 'GET', locationid });

        res.json(location);
    }
    catch (err) {
        next(err)
    }
});

app.post('/', emf, jsonParser, async (req, res, next) => {
    try {
        const { imageUrl, description, name } = req.body;

        // Create location
        const location = await handlers.createLocation(imageUrl, description, name);

        // Update metrics
        res.locals.metrics.setProperty("Payload", { operation: 'POST', locationid: location.locationid });

        res.status(201).json(location);
    }
    catch (err) {
        next(err)
    }
});

app.delete('/:locationid', emf, async (req, res, next) => {
    try {
        const { locationid } = req.params;

        // Delete location
        await handlers.deleteLocation(locationid);

        // Update metrics
        res.locals.metrics.setProperty("Payload", { operation: 'DELETE', locationid: locationid });

        res.status(200).send();
    }
    catch (err) {
        next(err)
    }
});

app.use(AWSXRay.express.closeSegment());

app.use(function (err, req, res, next) {
    console.error(err.stack)
    if (err instanceof handlers.ItemNotFoundError) {
        res.status(404).send(err.message);
    }
    else {
        res.status(500).send('Something broke!')
    }
  })

exports.app = app;