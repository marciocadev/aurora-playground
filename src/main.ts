import { join } from 'path';
import { App, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { AuroraPostgresEngineVersion, ClusterInstance, DatabaseCluster, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds';
import { Trigger } from 'aws-cdk-lib/triggers';
import { Construct } from 'constructs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { InstanceClass, InstanceSize, InstanceType, Vpc } from 'aws-cdk-lib/aws-ec2';

export class AuroraPlaygroungStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // Create the VPC needed for the Aurora Serverless DB Cluster
    const vpc = new Vpc(this, 'AuroraVPC');

    const dbName = 'TestDB';

    // Create the Serverless Aurora V2 DB Cluster setting the engine to postgres
    const cluster = new DatabaseCluster(this, 'AuroraTestCluster', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_14_15,
      }),
      defaultDatabaseName: dbName,
      removalPolicy: RemovalPolicy.DESTROY,
      writer: ClusterInstance.provisioned('writer', {
        instanceType: InstanceType.of(InstanceClass.R6G, InstanceSize.XLARGE4),
      }),
      readers: [
        ClusterInstance.serverlessV2('reader1', {
          scaleWithWriter: true,
        }),
        ClusterInstance.serverlessV2('reader2'),
      ],
      serverlessV2MinCapacity: 6.5,
      serverlessV2MaxCapacity: 64,
      vpc,
    });

    // Create the Serverless Aurora DB Cluster setting the engine to postgres
    // const cluster = new ServerlessCluster(this, 'AuroraTestCluster', {
    //   engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
    //   parameterGroup: ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
    //   defaultDatabaseName: dbName,
    //   vpc: vpc,
    //   scaling: { autoPause: Duration.seconds(0) },
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    const nodeJsProps: NodejsFunctionProps = {
      environment: {
        CLUSTER_ARN: cluster.clusterArn,
        SECRET_ARN: cluster.secret?.secretArn || '',
        DB_NAME: dbName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      timeout: Duration.minutes(1),
      runtime: Runtime.NODEJS_22_X,
      bundling: {
        sourceMap: true,
      },
    };

    // After the RDS deployment create the database and tables
    const triggerFn = new NodejsFunction(this, 'AuroraTriggerFunction', {
      entry: join(__dirname, 'lambda-functions/triggerFn.ts'),
      ...nodeJsProps,
    });
    cluster.grantDataApiAccess(triggerFn);
    new Trigger(this, 'AuroraTrigger', {
      handler: triggerFn,
      executeAfter: [cluster],
    });

    const postUserFn = new NodejsFunction(this, 'AuroraPostFunction', {
      entry: join(__dirname, 'lambda-functions/postUserFn.ts'),
      ...nodeJsProps,
    });
    cluster.grantDataApiAccess(postUserFn);

    const restApi = new RestApi(this, 'AuroraRestApi');
    const rootResource = restApi.root;
    rootResource.addResource('accounts').addMethod('POST', new LambdaIntegration(postUserFn));
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new AuroraPlaygroungStack(app, 'aurora-playground-dev', { env: devEnv });

app.synth();