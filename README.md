# Gravitate Health Preprocessing service example

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---
## Table of contents

- [Gravitate Health Preprocessing service example](#gravitate-health-preprocessing-service-example)
  - [Table of contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Kubernetes Deployment](#kubernetes-deployment)
    - [Deploy via Helm (OCI - Recommended)](#deploy-via-helm-oci---recommended)
    - [Local Development with Helm](#local-development-with-helm)
    - [Legacy: Manual kubectl Deployment](#legacy-manual-kubectl-deployment)
  - [Usage](#usage)
  - [Known issues and limitations](#known-issues-and-limitations)
  - [Getting help](#getting-help)
  - [Contributing](#contributing)
  - [License](#license)
  - [Authors and history](#authors-and-history)
  - [Acknowledgments](#acknowledgments)

---
## Introduction

This repository contains an example of a preprocesing service. A preprocessing service reads the Package Leaflet of an ePI, and adds semmantic annotations to it.

---
## Kubernetes Deployment

This service is designed as an internal Kubernetes microservice and does **not** require internet exposure. It is discovered by the Focusing Manager via the `eu.gravitate-health.fosps.preprocessing: "true"` label.

### Deploy via Helm (OCI - Recommended)

The Helm chart is distributed via OCI (Open Container Initiative) through GitHub Container Registry, allowing you to deploy without cloning the repository.

#### Prerequisites

- Helm 3.8.0 or later
- Kubernetes cluster access
- (Optional) Login credentials for GHCR if pulling a private chart

#### Quick Start

```bash
# Add Helm repository (if using traditional Helm repos - optional)
# For OCI, you can deploy directly without adding a repo

# Login to GitHub Container Registry (if required for private images)
helm registry login ghcr.io

# Deploy the chart directly from OCI registry
helm install preprocessing-service oci://ghcr.io/gravitate-health/charts/preprocessing-service-terminology --version 0.1.0
```

#### Custom Configuration

To override default values, create a `values-override.yaml` file:

```yaml
# values-override.yaml
replicaCount: 2
image:
  tag: "v0.14.0"
config:
  environment: "prod"
  termServerUrl: "http://terminology-service.default.svc.cluster.local:3000"
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi
```

Then deploy with custom values:

```bash
helm install preprocessing-service oci://ghcr.io/gravitate-health/charts/preprocessing-service-terminology \
  --version 0.1.0 \
  -f values-override.yaml
```

#### Upgrade an Existing Release

```bash
helm upgrade preprocessing-service oci://ghcr.io/gravitate-health/charts/preprocessing-service-terminology --version 0.1.0
```

#### Uninstall

```bash
helm uninstall preprocessing-service
```

### Local Development with Helm

#### Lint the Chart

```bash
helm lint charts/preprocessing-service-terminology/
```

#### Validate Generated Manifests

```bash
helm template my-release charts/preprocessing-service-terminology/ -f charts/preprocessing-service-terminology/values.yaml
```

#### Dry Run Installation

```bash
helm install my-release charts/preprocessing-service-terminology/ --dry-run --debug
```

### Legacy: Manual kubectl Deployment

For backward compatibility, raw Kubernetes manifests are still available in the `kubernetes/` directory:

```bash
kubectl apply -f kubernetes/base/001_preprocessing-service-mvp2-service.yaml
kubectl apply -f kubernetes/base/002_preprocessing-service-mvp2-deployment.yaml
```

**Note:** The legacy manifests are recommended only for testing. For production deployments, use the Helm chart.

---
## Usage

### Service Access

Once deployed (via Helm or kubectl), the service will be accessible internally within the Kubernetes cluster:

```
http://preprocessing-service-terminology.default.svc.cluster.local:3000/preprocess
```

If deployed with a custom release name, adjust the hostname accordingly:

```
http://<release-name>.default.svc.cluster.local:3000/preprocess
```

### API Endpoint

**POST** `/preprocess`

Accepts a complete ePI JSON (FHIR Bundle) and returns the annotated version with semantic markup on medical terminology.

#### Environment Variables

The service respects the following environment variables (automatically configured by the Helm chart):

- `SERVER_PORT` - HTTP server port (default: 3000)
- `LOG_LEVEL` - Logger verbosity: DEBUG, INFO, WARN, ERROR, FATAL (default: INFO)
- `ENVIRONMENT` - Deployment environment: prod, dev, staging (default: prod)
- `TERM_SERVER_URL` - **Required** - Terminology server base URL (e.g., `http://terminology-service:3000`)

---
## Known issues and limitations

---
## Getting help

---
## Contributing

---
## License

This project is distributed under the terms of the [Apache License, Version 2.0 (AL2)](http://www.apache.org/licenses/LICENSE-2.0).  The license applies to this file and other files in the [GitHub repository](https://github.com/Gravitate-Health/Focusing-module) hosting this file.

```
Copyright 2022 Universidad Politécnica de Madrid

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
---
## Authors and history

- Guillermo Mejías ([@gmej](https://github.com/gmej))


---
## Acknowledgments
