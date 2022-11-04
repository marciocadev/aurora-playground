import { awscdk } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.50.0',
  defaultReleaseBranch: 'main',
  name: 'aurora-playground',
  projenrcTs: true,

  deps: [
    'source-map-support',
    '@aws-sdk/client-rds-data',
    'uuid',
  ],
  devDeps: [
    'esbuild',
    '@types/aws-lambda',
    '@types/uuid',
  ],
});
project.synth();