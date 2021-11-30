import * as path from 'path';
import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Vpc } from "@aws-cdk/aws-ec2";
import { Cluster, ContainerImage } from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { NetworkLoadBalancer } from '@aws-cdk/aws-elasticloadbalancingv2';
import { AlbTarget } from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import { RestApi, VpcLink, Integration, IntegrationType, ConnectionType } from '@aws-cdk/aws-apigateway';

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "Main VPC");

    const cluster = new Cluster(this, 'Main Cluster', {
      vpc
    });

    const fargateService = new ApplicationLoadBalancedFargateService(this, 'Main Fargate Service', {
      assignPublicIp: false,
      cluster: cluster,
      cpu: 512,
      desiredCount: 3,
      memoryLimitMiB: 1024,
      publicLoadBalancer: false,
      taskImageOptions: {
        image: ContainerImage.fromAsset(path.join(__dirname, '../src/')),
      },
    });

    const nlb = new NetworkLoadBalancer(this, 'Main NLB', {
      vpc,
      internetFacing: false,
      crossZoneEnabled: true
    });
    // nlb.logAccessLogs()

    const listener = nlb.addListener('Listener', {
      port: 80
    });

    const targetGroup = listener.addTargets('Targets', {
      port: 80,
      targets: [new AlbTarget(fargateService.loadBalancer, 80)]
    });
    targetGroup.node.addDependency(fargateService.listener);

    // RestApi
    const restApi = new RestApi(this, 'Main API', {
      
    })

    const link = new VpcLink(this, 'link', {
      targets: [nlb],
    });

    const integration = new Integration({
      type: IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      options: {
        connectionType: ConnectionType.VPC_LINK,
        vpcLink: link,
      },
    });

    restApi.root.addMethod('GET', integration, {
      methodResponses: [{statusCode: '200'}],
    })
  }
}
