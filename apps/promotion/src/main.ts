import server from '@ecomm/server';
import { envConfig } from './app/lib/env';
import { app } from './app/app';

async function main() {
  await server(app, envConfig);
}
void main();
