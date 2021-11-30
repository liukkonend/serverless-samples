import * as path from 'path';
import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Vpc, Peer, Port } from "@aws-cdk/aws-ec2";
import { Cluster, ContainerImage } from '@aws-cdk/aws-ecs';
import { NetworkLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { RestApi, VpcLink, Integration, IntegrationType, ConnectionType } from '@aws-cdk/aws-apigateway';

export default class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "Main VPC");

    const cluster = new Cluster(this, 'Main Cluster', {
      vpc
    });

    // API Gateway REST API
    const restApi = new RestApi(this, 'Main API');

    // This is the Orders Service that will be mapped to the /orders API Gateway endpoint
    const ordersService = new NetworkLoadBalancedFargateService(this, 'Orders Fargate Service', {
      assignPublicIp: false,
      cluster: cluster,
      cpu: 512,
      desiredCount: 3,
      memoryLimitMiB: 1024,
      publicLoadBalancer: false,
      taskImageOptions: {
        image: ContainerImage.fromAsset(path.join(__dirname, '../src/orders-service/')),
      }
    });
    ordersService.service.connections.allowFrom(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(80));

    // VPC Link used to access the internal Fargate service
    const ordersVpcLink = new VpcLink(this, 'Orders Service VPC Link', {
      targets: [ordersService.loadBalancer],
    });

    const ordersResource = restApi.root.addResource('orders');
    ordersResource.addMethod('GET',
      new Integration({
        type: IntegrationType.HTTP_PROXY,
        integrationHttpMethod: 'GET',
        options: {
          connectionType: ConnectionType.VPC_LINK,
          vpcLink: ordersVpcLink,
        },
      }), {
      methodResponses: [{ statusCode: '200' }],
    });


    // This is the Wish list Service that will be mapped to the /wishlists API Gateway endpoint
    const wishlistSerivce = new NetworkLoadBalancedFargateService(this, 'Wish List Fargate Service', {
      assignPublicIp: false,
      cluster: cluster,
      cpu: 512,
      desiredCount: 3,
      memoryLimitMiB: 1024,
      publicLoadBalancer: false,
      taskImageOptions: {
        image: ContainerImage.fromAsset(path.join(__dirname, '../src/wishlists-service/')),
      }
    });
    wishlistSerivce.service.connections.allowFrom(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(80));

    // VPC Link used to access the internal Fargate service
    const wishlistsVpcLink = new VpcLink(this, 'Wishlists Service VPC Link', {
      targets: [wishlistSerivce.loadBalancer],
    });

    const wishlistsResource = restApi.root.addResource('wishlists');
    wishlistsResource.addMethod('GET',
      new Integration({
        type: IntegrationType.HTTP_PROXY,
        integrationHttpMethod: 'GET',
        options: {
          connectionType: ConnectionType.VPC_LINK,
          vpcLink: wishlistsVpcLink,
        },
      }), {
      methodResponses: [{ statusCode: '200' }],
    });
  }
}
