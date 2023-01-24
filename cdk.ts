import "dotenv/config";

import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { RegistryImage } from "@cdktf/provider-docker/lib/registry-image";
import { ArtifactRegistryRepository } from "@cdktf/provider-google/lib/artifact-registry-repository";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { readFileSync } from "fs";

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const googleProvider = new GoogleProvider(this, "google", {
      credentials: readFileSync(
        process.env.GCP_CREDENTIALS_PATH || "",
        "utf-8"
      ),
      project: "terraform-playground-375515",
      region: "northamerica-northeast2",
      zone: "northamerica-northeast2-a",
    });

    const artifactRegistry = new ArtifactRegistryRepository(
      this,
      "artifactRegistry",
      {
        location: googleProvider.region,
        format: "DOCKER",
        repositoryId: "terraform-playground",
      }
    );

    new DockerProvider(this, "docker", {
      registryAuth: [
        {
          address: `${artifactRegistry.location}-docker.pkg.dev`,
          username: "_json_key_base64",
          password: readFileSync(
            process.env.GCP_CREDENTIALS_PATH || "",
            "base64"
          ),
        },
      ],
    });

    const image = new Image(this, "dockerImage", {
      name: `${artifactRegistry.location}-docker.pkg.dev/${artifactRegistry.project}/${artifactRegistry.repositoryId}/tf-playground:latest`,
      buildAttribute: {
        context: __dirname,
      },
    });

    new RegistryImage(this, "registryImage", {
      name: image.name,
    });
  }
}

const app = new App();
new MyStack(app, "terraform-playground");
app.synth();
