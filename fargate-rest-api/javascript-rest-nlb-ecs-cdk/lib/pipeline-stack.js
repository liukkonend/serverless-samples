const { Stack, Stage } = require('aws-cdk-lib');
const { CodePipeline, CodeBuildStep, CodePipelineSource, ShellStep } = require('aws-cdk-lib/pipelines');
const codecommit = require('aws-cdk-lib/aws-codecommit');
const ecr = require('aws-cdk-lib/aws-ecr');
const { LinuxBuildImage, BuildSpec } = require('aws-cdk-lib/aws-codebuild');
const { PolicyStatement } = require('aws-cdk-lib/aws-iam');

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

        const bookingsServiceRepo = new ecr.Repository(this, 'bookingsServiceRepository', {
            repositoryName: `${Stack.of(this).stackName}-bookings-service-repository`,
            imageScanOnPush: true
        });

        const locationsServiceRepo = new ecr.Repository(this, 'locationsServiceRepository', {
            repositoryName: `${Stack.of(this).stackName}-locations-service-repository`,
            imageScanOnPush: true
        });

        const resourcesServiceRepo = new ecr.Repository(this, 'resourcesServiceRepository', {
            repositoryName: `${Stack.of(this).stackName}-resources-service-repository`,
            imageScanOnPush: true
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

        const ecrPolicyStatement = new PolicyStatement({
            actions: [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:GetRepositoryPolicy",
                "ecr:DescribeRepositories",
                "ecr:ListImages",
                "ecr:DescribeImages",
                "ecr:BatchGetImage",
                "ecr:GetLifecyclePolicy",
                "ecr:GetLifecyclePolicyPreview",
                "ecr:ListTagsForResource",
                "ecr:DescribeImageScanFindings",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage"
            ],
            resources: ["*"],
        });

        const bookingsServiceBuildStep = new CodeBuildStep('BookingsServiceCodeBuild', {
            installCommands: [
                'cd javascript-rest-nlb-ecs-cdk/src/api/bookings',
                'npm install',
                'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com',
                'BOOKINGS_COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
            ],
            commands: [
                'npm run test:unit',
                'rm -rf ./__tests__',
                'docker build --build-arg BASE_IMAGE=$BASE_IMAGE -t $BOOKINGS_SERVICE_ECR_REPOSITORY_URI:latest .',
                'docker tag $BOOKINGS_SERVICE_ECR_REPOSITORY_URI:latest $BOOKINGS_SERVICE_ECR_REPOSITORY_URI:$BOOKINGS_SERVICE_IMAGE_TAG',
                'docker push $BOOKINGS_SERVICE_ECR_REPOSITORY_URI:latest',
                'docker push $BOOKINGS_SERVICE_ECR_REPOSITORY_URI:$BOOKINGS_SERVICE_IMAGE_TAG',
                'printf \'[{"name":"hello-world","imageUri":"%s"}]\' $BOOKINGS_SERVICE_ECR_REPOSITORY_URI:$BOOKINGS_COMMIT_HASH > blah.json'
            ],
            buildEnvironment: {
                privileged: true,
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
                environmentVariables: {
                    'AWS_ACCOUNT_ID': { value: Stack.of(this).account },
                    'BASE_IMAGE': { value: `${Stack.of(this).account}.dkr.ecr.${Stack.of(this).region}.amazonaws.com/nodejsbase:latest` },
                    'BOOKINGS_SERVICE_ECR_REPOSITORY_URI': { value: bookingsServiceRepo.repositoryUri },
                    'BOOKINGS_SERVICE_IMAGE_TAG': { value: '1.0.0' }

                }
            },
            rolePolicyStatements: [
                ecrPolicyStatement
            ],
            primaryOutputDirectory: 'javascript-rest-ecs-cdk/src/api/bookings'
        });

        const locationsServiceBuildStep = new CodeBuildStep('LocationsServiceCodeBuild', {
            installCommands: [
                'cd javascript-rest-ecs-cdk/src/api/locations',
                'npm install',
                'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com'
            ],
            commands: [
                'npm run test:unit',
                'rm -rf ./__tests__',
                'docker build --build-arg BASE_IMAGE=$BASE_IMAGE -t $LOCATIONS_SERVICE_ECR_REPOSITORY_URI:latest .',
                'docker tag $LOCATIONS_SERVICE_ECR_REPOSITORY_URI:latest $LOCATIONS_SERVICE_ECR_REPOSITORY_URI:$LOCATIONS_SERVICE_IMAGE_TAG',
                'docker push $LOCATIONS_SERVICE_ECR_REPOSITORY_URI:latest',
                'docker push $LOCATIONS_SERVICE_ECR_REPOSITORY_URI:$LOCATIONS_SERVICE_IMAGE_TAG'
            ],
            buildEnvironment: {
                privileged: true,
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
                environmentVariables: {
                    'AWS_ACCOUNT_ID': { value: Stack.of(this).account },
                    'BASE_IMAGE': { value: `${Stack.of(this).account}.dkr.ecr.${Stack.of(this).region}.amazonaws.com/nodejsbase:latest` },
                    'LOCATIONS_SERVICE_ECR_REPOSITORY_URI': { value: locationsServiceRepo.repositoryUri },
                    'LOCATIONS_SERVICE_IMAGE_TAG': { value: '1.0.0' }

                }
            },
            rolePolicyStatements: [
                ecrPolicyStatement
            ]
        });

        const resourcesServiceBuildStep = new CodeBuildStep('ResourcesServiceCodeBuild', {
            installCommands: [
                'cd javascript-rest-ecs-cdk/src/api/resources',
                'npm install',
                'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com'
            ],
            commands: [
                'npm run test:unit',
                'rm -rf ./__tests__',
                'docker build --build-arg BASE_IMAGE=$BASE_IMAGE -t $RESOURCES_SERVICE_ECR_REPOSITORY_URI:latest .',
                'docker tag $RESOURCES_SERVICE_ECR_REPOSITORY_URI:latest $RESOURCES_SERVICE_ECR_REPOSITORY_URI:$RESOURCES_SERVICE_IMAGE_TAG',
                'docker push $RESOURCES_SERVICE_ECR_REPOSITORY_URI:latest',
                'docker push $RESOURCES_SERVICE_ECR_REPOSITORY_URI:$RESOURCES_SERVICE_IMAGE_TAG'
            ],
            buildEnvironment: {
                privileged: true,
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
                environmentVariables: {
                    'AWS_ACCOUNT_ID': { value: Stack.of(this).account },
                    'BASE_IMAGE': { value: `${Stack.of(this).account}.dkr.ecr.${Stack.of(this).region}.amazonaws.com/nodejsbase:latest` },
                    'RESOURCES_SERVICE_ECR_REPOSITORY_URI': { value: resourcesServiceRepo.repositoryUri },
                    'RESOURCES_SERVICE_IMAGE_TAG': { value: '1.0.0' }

                }
            },
            rolePolicyStatements: [
                ecrPolicyStatement
            ]
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