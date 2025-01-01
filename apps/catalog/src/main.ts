import server from '@ecomm/server';
import { envConfig } from './app/lib/env.ts';
import { app } from './app/app.ts';

async function main() {
  await server(app, envConfig);
}
void main();
