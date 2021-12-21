const path = require('path');
const { Stack } = require('aws-cdk-lib');
const { Vpc, Peer, Port } = require('aws-cdk-lib/aws-ec2');
const { LogGroup, RetentionDays } = require('aws-cdk-lib/aws-logs');
const { Cluster, Protocol, ContainerImage, FargateTaskDefinition, EcrImage, LogDrivers } = require('aws-cdk-lib/aws-ecs');
const { Repository } = require('aws-cdk-lib/aws-ecr');
const { NetworkLoadBalancedFargateService } = require('aws-cdk-lib/aws-ecs-patterns');
const { RestApi, VpcLink, MethodLoggingLevel, ConnectionType, Integration, IntegrationType, LogGroupLogDestination, TokenAuthorizer } = require('aws-cdk-lib/aws-apigateway');
const { Table, AttributeType } = require('aws-cdk-lib/aws-dynamodb');
const elb = require('aws-cdk-lib/aws-elasticloadbalancingv2');
const { Policy, ManagedPolicy, PolicyStatement } = require('aws-cdk-lib/aws-iam');
const { Function, Runtime, Code } = require('aws-cdk-lib/aws-lambda');
class AppStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const vpc = new Vpc(this, "VPC");

    const cluster = new Cluster(this, 'Main Cluster', { vpc });

    // Locations Database
    const locationsTable = new Table(this, 'Table', {
      tableName: "LocationsTable",
      partitionKey: { name: 'locationid', type: AttributeType.STRING },
      readCapacity: 2,
      writeCapacity: 2
    });

    // Locations Service
    const locationsServiceLogGroup = new LogGroup(this, 'Locations Service Log Group', {
      retention: RetentionDays.ONE_WEEK
    });

    const locationServiceTaskDefinition = new FargateTaskDefinition(this, 'Locations Service Task Definition', {
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    // Add DynamoDB permissions
    const locationsServiceTaskRole = locationServiceTaskDefinition.taskRole;
    locationsTable.grantReadWriteData(locationsServiceTaskRole);
    locationsServiceTaskRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"));
    locationsServiceTaskRole.attachInlinePolicy(new Policy(this, `CloudWatchLogs`, {
      statements: [
        new PolicyStatement({
          resources: ['arn:aws:logs:*:*:*'],
          actions: [
            'logs:CreateLogGroup', 
            'logs:CreateLogStream', 
            'logs:PutLogEvents', 
            'logs:DescribeLogStream'],
        }),
      ],
    }))

    locationServiceTaskDefinition.addContainer('locations-service', {
      environment: {
        'LOCATIONS_TABLE': locationsTable.tableName,
        'AWS_EMF_SERVICE_NAME': 'LocationsService',
        'AWS_EMF_LOG_GROUP_NAME': locationsServiceLogGroup.logGroupName,
        'AWS_EMF_NAMESPACE': Stack.of(this).stackName
      },
      portMappings:[
        { containerPort: 8080 }
      ],
      essential: true,
      logging: LogDrivers.awsLogs({
        logGroup: locationsServiceLogGroup,
        streamPrefix: 'ecs'
      }),
      image: new EcrImage(Repository.fromRepositoryName(this, 'locations-service-repo', 'fargate-rest-api-pipeline-locations-service-repository'), 'latest')
    });

    locationServiceTaskDefinition.addContainer('cwagent', {
      environment: {
        'CW_CONFIG_CONTENT': `
            {
              "logs": {
                "metrics_collected": {
                  "emf": { }
                }
              }
            }
        `
      },
      portMappings:[
        { containerPort: 25888, protocol: Protocol.TCP }
      ],
      logging: LogDrivers.awsLogs({
        logGroup: locationsServiceLogGroup,
        streamPrefix: 'ecs'
      }),
      image: ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
    });

    locationServiceTaskDefinition.addContainer('xray-daemon', {
      portMappings:[
        { hostPort: 2000, containerPort: 2000, protocol: Protocol.UDP }
      ],
      logging: LogDrivers.awsLogs({
        logGroup: locationsServiceLogGroup,
        streamPrefix: 'ecs'
      }),
      image: ContainerImage.fromRegistry('amazon/aws-xray-daemon'),
    });

    const locationsService = new NetworkLoadBalancedFargateService(this, 'Locations Service', {
      assignPublicIp: false,
      cluster: cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 3,
      publicLoadBalancer: false,
      taskDefinition: locationServiceTaskDefinition
    });

    locationsService.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '5')
    locationsService.targetGroup.configureHealthCheck({
      protocol: elb.Protocol.HTTP,
      port: '8080',
      path: '/health'
    });

    locationsService.service.connections.allowFrom(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(8080));

    const locationsServiceVpcLink = new VpcLink(this, 'Locations Service VPCLink', {
      targets: [locationsService.loadBalancer],
    });

    // API Gateway REST API
    const restApiAccessLogGroup = new LogGroup(this, 'REST API Log Group', {
      retention: RetentionDays.ONE_MONTH
    });

    const api = new RestApi(this, 'REST API', {
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Forwarded-For',
          'X-Amz-Security-Token'
        ],
        allowMethods: ['OPTIONS', 'GET', 'PUT', 'DELETE'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
      deployOptions: {
        metricsEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        tracingEnabled: true,
        accessLogDestination: new LogGroupLogDestination(restApiAccessLogGroup),
        accessLogFormat: '{ "requestId":"$context.requestId", "ip": "$context.identity.sourceIp", "requestTime":"$context.requestTime", "httpMethod":"$context.httpMethod","routeKey":"$context.routeKey", "status":"$context.status","protocol":"$context.protocol", "integrationStatus": $context.integrationStatus, "integrationLatency": $context.integrationLatency, "responseLength":"$context.responseLength" }'
      }
    });

    const authorizerFunction = new Function(this, 'authorizer', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'authorizer.handler',
      code: Code.fromAsset(path.join(__dirname, '..', 'src', 'api')),
    });

    const lambdaAuthorizer = new TokenAuthorizer(this, 'lambda-authorizer', {
      handler: authorizerFunction
    })

    const locationsResource = api.root.addResource("locations");
    const locationsGetMethod = locationsResource.addMethod('GET', new Integration({
      type: IntegrationType.HTTP_PROXY,
      uri: `http://${locationsService.loadBalancer.loadBalancerDnsName}/locations`,
      integrationHttpMethod: 'GET',
      passthroughBehavior: 'when_no_match',
      options: {
        connectionType: ConnectionType.VPC_LINK,
        vpcLink: locationsServiceVpcLink
      },
      requestParameters: {
        'integration.request.header.requestId': 'context.requestId',
        'integration.request.header.X-Amzn-Trace-Id': 'context.xrayTraceId'
      }
    }), { authorizer: lambdaAuthorizer });
  }
}

module.exports = { AppStack }
