const app = process.env.APP_NAME;
const port = process.env.PORT;
if (!app || !port) process.exit(1);
const path = app === 'gateway' ? '/ready' : '/api/' + app + '/health/ready';
const headers = app === 'gateway' && process.env.GATEWAY_TOKEN ? {'x-access-token': process.env.GATEWAY_TOKEN} : {};
fetch('http://127.0.0.1:' + port + path, {headers, signal: AbortSignal.timeout(5000)})
  .then((response) => { process.exitCode = response.ok ? 0 : 1; })
  .catch(() => { process.exitCode = 1; });
