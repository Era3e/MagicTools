import { syncKnowledgeBundle } from "./lib/knowledge-bundle.mjs";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--bundle") options.bundlePath = argv[++index];
  else if (arg === "--base-url") options.baseUrl = argv[++index];
  else if (arg === "--token") options.token = argv[++index];
    else if (arg === "--publish-product") options.publishProduct = true;
    else if (arg === "--version") options.version = argv[++index];
    else if (arg === "--deployment-ref") options.deploymentRef = argv[++index];
    else if (arg === "--published-by") options.publishedBy = argv[++index];
    else throw new Error("未知参数: " + arg);
  }
  return options;
}

const result = await syncKnowledgeBundle(parseArgs(process.argv.slice(2)));
console.log(JSON.stringify(result, null, 2));
