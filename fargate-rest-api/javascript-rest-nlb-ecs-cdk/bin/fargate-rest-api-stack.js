#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { PipelineStack } = require('../lib/pipeline-stack');

const app = new cdk.App();
new PipelineStack(app, 'pipelinestack');