import server from '@ecomm/Server';
import { envConfig } from './app/lib/env';
import { app } from './app/app';

async function main() {
  await server(app, envConfig);
}
void main();
