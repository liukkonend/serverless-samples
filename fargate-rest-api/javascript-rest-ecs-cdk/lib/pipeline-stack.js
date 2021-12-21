const path = require('path');
const { Stack } = require('aws-cdk-lib');
const { CodePipeline, CodeBuildStep, CodePipelineSource, ShellStep } = require('aws-cdk-lib/pipelines');
const { Repository } = require('aws-cdk-lib/aws-codecommit');
const { LinuxBuildImage } = require('aws-cdk-lib/aws-codebuild');

class PipelineStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const repo = new Repository(this, 'codeRepository' ,{
            repositoryName: Stack.of(this).stackName,
            description: 'Code repository for serverless API sample application'
        });

        const pipeline = new CodePipeline(this, 'Pipeline', {
            selfMutation: false,
            synth: new ShellStep('Synth', {
                input: CodePipelineSource.codeCommit(repo, 'main'),
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth',
                ],
            }),
        });

        const buildWave = pipeline.addWave('BuildImages', {
            post: [
                new CodeBuildStep('LocationsServiceCodeBuild', {
                    commands: ['ls -ltr'],
                    buildEnvironment: {
                        buildImage: LinuxBuildImage.AMAZON_LINUX_2_3
                    }
                })
            ]
        });
    }
};

module.exports = { PipelineStack }