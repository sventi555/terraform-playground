import "dotenv/config";

import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { ComputeNetwork } from "@cdktf/provider-google/lib/compute-network";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { readFileSync } from "fs";

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new GoogleProvider(this, "google", {
      credentials: readFileSync(process.env.GCP_CREDENTIALS_PATH || "", "utf8"),
      project: "terraform-playground-375515",
      region: "northamerica-northeast2",
      zone: "northamerica-northeast2-a",
    });

    new ComputeNetwork(this, "vpcNetwork", {
      name: "terraform-network",
    });
  }
}

const app = new App();
new MyStack(app, "terraform-playground");
app.synth();
