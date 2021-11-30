#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import AppStack from '../lib/app-stack';
import PipelineStack from '../lib/pipeline-stack';

const app = new cdk.App();
new AppStack(app, 'AppStack');
new PipelineStack(app, 'PipelineStack');
app.synth();

