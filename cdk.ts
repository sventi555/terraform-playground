import "dotenv/config";

import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { RegistryImage } from "@cdktf/provider-docker/lib/registry-image";
import { ArtifactRegistryRepository } from "@cdktf/provider-google/lib/artifact-registry-repository";
import { CloudRunService } from "@cdktf/provider-google/lib/cloud-run-service";
import { CloudRunServiceIamBinding } from "@cdktf/provider-google/lib/cloud-run-service-iam-binding";
import { CloudRunServiceIamPolicy } from "@cdktf/provider-google/lib/cloud-run-service-iam-policy";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { readFileSync } from "fs";

import { DataGoogleIamPolicy } from "@cdktf/provider-google/lib/data-google-iam-policy";

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const region = "northamerica-northeast2";

    const googleProvider = new GoogleProvider(this, "google", {
      credentials: readFileSync(
        process.env.GCP_CREDENTIALS_PATH || "",
        "utf-8"
      ),
      project: "terraform-playground-375515",
      region,
      zone: "northamerica-northeast2-a",
    });

    const artifactRegistry = new ArtifactRegistryRepository(
      this,
      "artifactRegistry",
      {
        location: region,
        format: "DOCKER",
        repositoryId: "terraform-playground",
      }
    );

    new DockerProvider(this, "docker", {
      registryAuth: [
        {
          address: `${region}-docker.pkg.dev`,
          username: "_json_key_base64",
          password: readFileSync(
            process.env.GCP_CREDENTIALS_PATH || "",
            "base64"
          ),
        },
      ],
    });

    const image = new Image(this, "dockerImage", {
      name: `${region}-docker.pkg.dev/${artifactRegistry.project}/${artifactRegistry.repositoryId}/tf-playground:1.0.0`,
      buildAttribute: {
        context: __dirname,
        platform: "linux/amd64",
      },
    });

    new RegistryImage(this, "registryImage", {
      name: image.name,
    });

    const runService = new CloudRunService(this, "runService", {
      location: region,
      name: "tf-playground",

      template: {
        spec: {
          containers: [{ image: image.name }],
        },
      },
    });

    const noAuthBinding = new DataGoogleIamPolicy(this, "noAuth", {
      binding: [
        {
          role: "roles/run.invoker",
          members: ["allUsers"],
        },
      ],
    });

    new CloudRunServiceIamPolicy(this, "runServiceIamPolicy", {
      location: region,
      project: googleProvider.project,
      service: runService.name,
      policyData: noAuthBinding.policyData,
    });
  }
}

const app = new App();
new MyStack(app, "terraform-playground");
app.synth();
