import "dotenv/config";

import { Construct } from "constructs";
import {
  App,
  MapTerraformIterator,
  TerraformIterator,
  TerraformStack,
} from "cdktf";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Image } from "@cdktf/provider-docker/lib/image";
import { RegistryImage } from "@cdktf/provider-docker/lib/registry-image";
import { ArtifactRegistryRepository } from "@cdktf/provider-google/lib/artifact-registry-repository";
import { CloudRunDomainMapping } from "@cdktf/provider-google/lib/cloud-run-domain-mapping";
import { CloudRunService } from "@cdktf/provider-google/lib/cloud-run-service";
import { CloudRunServiceIamPolicy } from "@cdktf/provider-google/lib/cloud-run-service-iam-policy";
import { DataGoogleIamPolicy } from "@cdktf/provider-google/lib/data-google-iam-policy";
import { DnsRecordSet } from "@cdktf/provider-google/lib/dns-record-set";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { readFileSync } from "fs";

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const US_E1 = "us-east1";
    const NA_NE2 = "northamerica-northeast2";

    const project = "terraform-playground-375515";

    new GoogleProvider(this, "google", {
      credentials: readFileSync(
        process.env.GCP_CREDENTIALS_PATH || "",
        "utf-8"
      ),
      project,
      region: NA_NE2,
      zone: `${NA_NE2}-a`,
    });

    const artifactRegistry = new ArtifactRegistryRepository(
      this,
      "artifactRegistry",
      {
        location: NA_NE2,
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
      name: `${artifactRegistry.location}-docker.pkg.dev/${artifactRegistry.project}/${artifactRegistry.repositoryId}/tf-playground:1.0.0`,
      buildAttribute: {
        context: __dirname,
        platform: "linux/amd64",
      },
    });

    const registryImage = new RegistryImage(this, "registryImage", {
      name: image.name,
    });

    const runService = new CloudRunService(this, "runService", {
      location: US_E1, // to support domain mapping
      name: "tf-playground",

      template: {
        spec: {
          containers: [{ image: image.name }],
        },
      },

      dependsOn: [registryImage],
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
      location: runService.location,
      service: runService.name,
      policyData: noAuthBinding.policyData,
    });

    const domainMapping = new CloudRunDomainMapping(this, "runDomainMapping", {
      location: "us-east1",
      name: "amandahugandkiss.me",
      metadata: {
        namespace: project,
      },
      spec: {
        routeName: runService.name,
      },
    });

    // If there is a better way to group these more generically, then I'm all for it
    const ARecordSet = new DnsRecordSet(this, "ARecordSet", {
      managedZone: "amandahugandkiss-me",
      name: "amandahugandkiss.me.",
      type: "A",
      dependsOn: [domainMapping],
    });

    ARecordSet.addOverride(
      "rrdatas",
      `\${[
          for record in ${domainMapping.fqn}.status[0].resource_records : record.rrdata if record.type == "A"
        ]
      }`
    );

    const AAAARecordSet = new DnsRecordSet(this, "AAAARecordSet", {
      managedZone: "amandahugandkiss-me",
      name: "amandahugandkiss.me.",
      type: "AAAA",
      dependsOn: [domainMapping],
    });

    AAAARecordSet.addOverride(
      "rrdatas",
      `\${[
          for record in ${domainMapping.fqn}.status[0].resource_records : record.rrdata if record.type == "AAAA"
        ]
      }`
    );
  }
}

const app = new App();
new MyStack(app, "terraform-playground");
app.synth();
