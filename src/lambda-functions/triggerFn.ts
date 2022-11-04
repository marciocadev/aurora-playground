import 'source-map-support/register';
import { RDSDataClient, ExecuteStatementCommand, ExecuteStatementCommandInput } from '@aws-sdk/client-rds-data';

const rdsClient = new RDSDataClient({ region: process.env.AWS_REGION });

export const handler = async() => {
  try {
    let paramProps: ExecuteStatementCommandInput = {
      resourceArn: process.env.CLUSTER_ARN,
      secretArn: process.env.SECRET_ARN,
      database: process.env.DB_NAME,
      sql: undefined,
    };

    let sql = 'CREATE TABLE IF NOT EXISTS accounts ('
      + 'user_id VARCHAR(50) PRIMARY KEY,'
      + 'username VARCHAR(50) UNIQUE NOT NULL,'
      + 'password VARCHAR(50) NOT NULL,'
      + 'email VARCHAR(255) UNIQUE NOT NULL,'
      + 'created_on TIMESTAMP(3) NOT NULL,' // to millisecond precision
      + 'last_login TIMESTAMP(3))';
    const paramTableAccounts: ExecuteStatementCommandInput = {
      ...paramProps,
      sql: sql,
    };
    console.log(paramTableAccounts);
    await rdsClient.send(new ExecuteStatementCommand(paramTableAccounts));

    sql = 'CREATE TABLE IF NOT EXISTS roles ('
      + 'role_id VARCHAR(50) PRIMARY KEY,'
      + 'role_name VARCHAR(255))';
    const paramTableRoles: ExecuteStatementCommandInput = {
      ...paramProps,
      sql: sql,
    };
    await rdsClient.send(new ExecuteStatementCommand(paramTableRoles));

    sql = 'CREATE TABLE IF NOT EXISTS account_roles ('
      + 'user_id VARCHAR(50),'
      + 'role_id VARCHAR(50),'
      + 'PRIMARY KEY(user_id, role_id),'
      + 'FOREIGN KEY(role_id) REFERENCES roles (role_id),'
      + 'FOREIGN KEY(user_id) REFERENCES accounts (user_id))';
    const paramTableAccountRoles: ExecuteStatementCommandInput = {
      ...paramProps,
      sql: sql,
    };
    await rdsClient.send(new ExecuteStatementCommand(paramTableAccountRoles));
  } catch (err) {
    console.error(err);
  }
};
