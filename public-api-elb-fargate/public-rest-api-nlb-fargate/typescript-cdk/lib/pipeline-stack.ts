import * as cdk from '@aws-cdk/core';
import { CodePipeline, CodePipelineSource, CodeBuildStep } from '@aws-cdk/pipelines';
import { Repository } from '@aws-cdk/aws-codecommit';

export default class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repo = new Repository(this, 'Repo', {
        repositoryName: 'MyRepo',
    });

    const pipeline = new CodePipeline(this, 'Pipeline', {
        pipelineName: 'WorkshopPipeline',
        synth: new CodeBuildStep('SynthStep', {
                input: CodePipelineSource.codeCommit(repo, 'master'),
                installCommands: [
                    'npm install -g aws-cdk'
                ],
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth AppStack'
                ]
            }
        )
    });
  }
}