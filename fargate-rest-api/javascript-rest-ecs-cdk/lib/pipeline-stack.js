const { Stack, Stage } = require('aws-cdk-lib');
const { CodePipeline, CodeBuildStep, CodePipelineSource, ShellStep } = require('aws-cdk-lib/pipelines');
const codecommit = require('aws-cdk-lib/aws-codecommit');
const { LinuxBuildImage } = require('aws-cdk-lib/aws-codebuild');

const { AppStack } = require('./app-stack');

class ApplicationTestStage extends Stage {
    constructor(scope, id, props) {
        super(scope, id, props);

        new AppStack(this, 'appStack', props);
    }
}
class PipelineStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const codeRepo = new codecommit.Repository(this, 'codeRepository', {
            repositoryName: Stack.of(this).stackName,
            description: 'Code repository for serverless API sample application'
        });

        const pipeline = new CodePipeline(this, 'Pipeline', {
            synth: new ShellStep('Synth', {
                input: CodePipelineSource.codeCommit(codeRepo, 'main'),
                primaryOutputDirectory: `javascript-rest-ecs-cdk/cdk.out`,
                commands: [
                    'cd javascript-rest-ecs-cdk',
                    'npm ci',
                    'npx cdk synth',
                ],
            }),
        });

        const bookingsServiceBuildStep = new CodeBuildStep('BookingsServiceCodeBuild', {
            installCommands: [
                'cd javascript-rest-ecs-cdk/src/api/bookings',
                'npm install',
            ],
            commands: [
                'npm run test:unit',
                'rm -rf ./__tests__',
            ],
            buildEnvironment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3
            }
        });

        const locationsServiceBuildStep = new CodeBuildStep('LocationsServiceCodeBuild', {
            installCommands: [
                'cd javascript-rest-ecs-cdk/src/api/locations',
                'npm install',
            ],
            commands: [
                'npm run test:unit',
                'rm -rf ./__tests__'
            ],
            buildEnvironment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3
            }
        });

        const resourcesServiceBuildStep = new CodeBuildStep('ResourcesServiceCodeTest', {
            installCommands: [
                'cd javascript-rest-ecs-cdk/src/api/resources',
                'npm install'
            ],
            commands: [
                'npm run test:unit',
                'rm -rf ./__tests__'
            ],
            buildEnvironment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3
            }
        });

        pipeline.addWave('BuildImages', {
            post: [
                bookingsServiceBuildStep,
                locationsServiceBuildStep,
                resourcesServiceBuildStep
            ]
        });

        pipeline.addStage(new ApplicationTestStage(this, 'Testing'));
    }
};

module.exports = { PipelineStack }