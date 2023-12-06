import { Directory } from "../../deps.ts";
import { Client } from "../../sdk/client.gen.ts";
import { connect } from "../../sdk/connect.ts";
import { getDirectory } from "./lib.ts";

export enum Job {
  test = "test",
  fmt = "fmt",
  build = "build",
}

export const exclude = ["vendor", ".git"];

/**
 * @function
 * @description Run tests
 * @param {string | Directory | undefined} src
 * @returns {Directory | string}
 */
export async function test(
  src: Directory | string | undefined = "."
): Promise<string> {
  let result = "";
  await connect(async (client: Client) => {
    const context = getDirectory(client, src);
    const ctr = client
      .pipeline(Job.test)
      .container()
      .from("golang:latest")
      .withDirectory("/app", context, { exclude })
      .withWorkdir("/app")
      .withMountedCache("/go/pkg/mod", client.cacheVolume("go-mod"))
      .withMountedCache("/root/.cache/go-build", client.cacheVolume("go-build"))
      .withExec(["go", "test", "-v", "./..."]);
    result = await ctr.stdout();
  });
  return result;
}

/**
 * @function
 * @description Format the project
 * @param {string | Directory | undefined} src
 * @returns {Directory | string}
 */
export async function fmt(
  src: Directory | string | undefined = "."
): Promise<Directory | string> {
  let id = "";
  await connect(async (client: Client) => {
    const context = getDirectory(client, src);
    const ctr = client
      .pipeline(Job.fmt)
      .container()
      .from("golang:latest")
      .withDirectory("/app", context, { exclude })
      .withMountedCache("/go/pkg/mod", client.cacheVolume("go-mod"))
      .withMountedCache("/root/.cache/go-build", client.cacheVolume("go-build"))
      .withWorkdir("/app")

      .withExec(["go", "fmt", "./..."]);
    await ctr.stdout();
    id = await ctr.directory("/app/").id();
  });
  return id;
}

/**
 * @function
 * @description Build binary
 * @param {string | Directory | undefined} src
 * @returns {Directory | string}
 */
export async function build(
  src: Directory | string | undefined = ".",
  version: string = Deno.env.get("RELEASE_VERSION") || "latest"
): Promise<Directory | string> {
  let id = "";
  await connect(async (client: Client) => {
    const context = getDirectory(client, src);
    const ctr = client
      .pipeline(Job.build)
      .container()
      .from("golang:latest")
      .withDirectory("/app", context, { exclude })
      .withWorkdir("/app")
      .withMountedCache("/assets", client.cacheVolume("gh-release-assets"))
      .withMountedCache("/go/pkg/mod", client.cacheVolume("go-mod"))
      .withMountedCache("/root/.cache/go-build", client.cacheVolume("go-build"))
      .withExec(["go", "build"])
      .withExec([
        "tar",
        "-czf",
        `/assets/codegen_${version}_x86_64_unknown_linux-gnu.tar.gz`,
        "codegen",
      ])
      .withExec([
        "sh",
        "-c",
        `sha256sum /assets/codegen_${version}_x86_64_unknown_linux-gnu.tar.gz > /assets/codegen_${version}_x86_64_unknown_linux-gnu.tar.gz.sha256`,
      ]);
    await ctr.stdout();
    id = await ctr.directory("/app/").id();
  });
  return id;
}

export type JobExec = (
  src: Directory | string | undefined
) => Promise<Directory | string>;

export const runnableJobs: Record<Job, JobExec> = {
  [Job.test]: test,
  [Job.fmt]: fmt,
  [Job.build]: build,
};

export const jobDescriptions: Record<Job, string> = {
  [Job.test]: "Run tests",
  [Job.fmt]: "Format code",
  [Job.build]: "Build binary",
};
