export class ExecutorManagerClient {
  constructor({ baseUrl, token, executorId = "magictools-executor", leaseMilliseconds = 60_000, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
    this.executorId = executorId;
    this.leaseMilliseconds = leaseMilliseconds;
    this.fetchImpl = fetchImpl;
  }

  async claim() {
    const body = await this.request("POST", "/execution-jobs/claim", {
      executorId: this.executorId,
      leaseMilliseconds: this.leaseMilliseconds,
    });
    return body?.claimed === false ? null : body;
  }

  async heartbeat(job) {
    const body = await this.request("POST", "/execution-jobs/" + encodeURIComponent(job.jobId) + "/heartbeat", {
      extensionMilliseconds: this.leaseMilliseconds,
    }, job);
    return body?.status === "running";
  }

  async complete(job, result) {
    return this.request("POST", "/execution-jobs/" + encodeURIComponent(job.jobId) + "/complete", { result }, job);
  }

  async fail(job, error) {
    return this.request("POST", "/execution-jobs/" + encodeURIComponent(job.jobId) + "/fail", { error }, job);
  }

  async request(method, path, body, job) {
    const headers = {
      "content-type": "application/json",
      "x-manager-executor-token": this.token,
    };
    if (job?.runToken) headers["x-manager-run-token"] = job.runToken;
    let response;
    try {
      response = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new Error("Manager 请求失败：" + (error?.message ?? error));
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error("Manager HTTP " + response.status + "：" + text.slice(0, 500));
    }
    return response.json();
  }
}
