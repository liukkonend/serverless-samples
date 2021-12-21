#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { AppStack } = require('../lib/app-stack');
const { CognitoStack } = require('../lib/cognito-stack');
const { PipelineStack } = require('../lib/pipeline-stack');

const app = new cdk.App();
// new AppStack(app, 'blah');
new CognitoStack(app, 'cognitostack');
new PipelineStack(app, 'pipelinestack');