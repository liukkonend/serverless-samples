const { Stack, Tags } = require('aws-cdk-lib');
const { UserPool, CfnIdentityPool, Mfa, StringAttribute, OAuthScope } = require('aws-cdk-lib/aws-cognito');
const { Role, FederatedPrincipal } = require('aws-cdk-lib/aws-iam');

class CognitoStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const userPool = new UserPool(this, 'userPool', {
            userPoolName: Stack.of(this).stackName + "-UserPool",
            selfSignUpEnabled: true,
            autoVerify: { email: true, phone: true },
            mfa: Mfa.OPTIONAL,
            signInAliases: { email: true },
            standardAttributes: {
                email: {
                    mutable: true,
                    required: true
                },
                phoneNumber: {
                    mutable: false,
                    required: false
                }
            },
            customAttributes: {
                name: new StringAttribute({ mutable: true, required: true })
            }
        });

        const userPoolClient = userPool.addClient('userPoolClient', {
            userPoolClientName: Stack.of(this).stackName + "UserPoolClient",
            authFlows: {
                userPassword: true,
                userSrp: true
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    OAuthScope.OPENID,
                    OAuthScope.EMAIL
                ],
                callbackUrls: [
                    'http://localhost'
                ]
            }
        });

        const domain = userPool.addDomain('userPoolDomain', {
            cognitoDomain: { domainPrefix: userPoolClient.userPoolClientId }
        });

        // const identityPool = new CfnIdentityPool(this, 'identityPool', {
        //     identityPoolName: Stack.of(this).stackName + "-IdentityPool",
        //     cognitoIdentityProviders: [
        //         {
        //             clientId: userPoolClient.userPoolClientId, 
        //             roviderName: userPool.providerName
        //         }
        //     ],
        //     // And the other properties for your identity pool
        //     allowUnauthenticatedIdentities: false,
        // });

        // // Create role for unauthenticated users
        // const unauthenticatedRole = new Role(this, 'unauthenticatedRole', {
        //     assumedBy: new FederatedPrincipal(
        //         'cognito-identity.amazonaws.com',
        //         {
        //             StringEquals: {
        //                 'cognito-identity.amazonaws.com:aud': identityPool.ref
        //             },
        //             'ForAnyValue:StringLike': {
        //                 'cognito-identity.amazonaws.com:amr': 'unauthenticated',
        //             }
        //         },
        //         'sts:AssumeRoleWithWebIdentity'
        //     )
        // });
        // Tags.of(unauthenticatedRole).add('Name', Stack.of(this).stackName + " Cognito Identity Pool Unauthorized Role");

        // // Create role for authenticated users
        // const authenticatedRole = new Role(this, 'unauthenticatedRole', {
        //     assumedBy: new FederatedPrincipal(
        //         'cognito-identity.amazonaws.com',
        //         {
        //             StringEquals: {
        //                 'cognito-identity.amazonaws.com:aud': identityPool.ref
        //             },
        //             'ForAnyValue:StringLike': {
        //                 'cognito-identity.amazonaws.com:amr': 'authenticated',
        //             }
        //         },
        //         'sts:AssumeRoleWithWebIdentity'
        //     )
        // });
        // Tags.of(authenticatedRole).add('Name', Stack.of(this).stackName + " Cognito Identity Pool Authorized Role");
    }
}

module.exports = { CognitoStack }