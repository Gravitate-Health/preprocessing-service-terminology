{{/*
Expand the name of the chart.
*/}}
{{- define "preprocessing-service-terminology.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "preprocessing-service-terminology.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "preprocessing-service-terminology.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels used across all resources
*/}}
{{- define "preprocessing-service-terminology.labels" -}}
helm.sh/chart: {{ include "preprocessing-service-terminology.chart" . }}
{{ include "preprocessing-service-terminology.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "preprocessing-service-terminology.selectorLabels" -}}
app.kubernetes.io/name: {{ include "preprocessing-service-terminology.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service Discovery Labels
Required for discovery by Gravitate Health Focusing Manager
*/}}
{{- define "preprocessing-service-terminology.discoveryLabels" -}}
{{- if .Values.serviceDiscovery.enabled }}
{{ .Values.serviceDiscovery.label }}: "true"
{{- end }}
{{- end }}
