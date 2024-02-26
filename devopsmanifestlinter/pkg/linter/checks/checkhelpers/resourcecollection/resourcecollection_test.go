package resourcecollection_test

import (
	"devopsmanifestlinter/pkg/k8sparser"
	"devopsmanifestlinter/pkg/linter/checks/checkhelpers/resourcecollection"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResourceCollectionFindsHpasTargettingADeployment(t *testing.T) {
	p := k8sparser.NewParser()
	deployment, err := p.DecodeResource([]byte(`
apiVersion: apps/v1
kind: Deployment
metadata:
  name: concierge-core
  namespace: default
  labels:
    helm.sh/chart: concierge-0.1.32
    project: concierge
    app.kubernetes.io/version: "24.2.0"
    app.kubernetes.io/managed-by: Helm
    tags.datadoghq.com/env:  staging
    tags.datadoghq.com/service: concierge
    tags.datadoghq.com/version: 24.2.0
    role: core
spec:
  revisionHistoryLimit: 5
  strategy:
    rollingUpdate:
      maxSurge: 0
      maxUnavailable: 25%
    type: RollingUpdate
  selector:
    matchLabels:
      project: concierge
      role: core

  template:
    metadata:
      name: concierge-core
      labels:
        helm.sh/chart: concierge-0.1.32
        project: concierge
        app.kubernetes.io/version: "24.2.0"
        app.kubernetes.io/managed-by: Helm
        tags.datadoghq.com/env:  staging
        tags.datadoghq.com/service: concierge
        tags.datadoghq.com/version: 24.2.0
        role: core
      annotations:
        vault.hashicorp.com/role: "concierge"
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/agent-init-first: "true"
        vault.hashicorp.com/agent-inject-secret-concierge: "scorebet/data/concierge/staging/ca-default"
        vault.hashicorp.com/agent-inject-template-concierge: |
          {{- with secret "scorebet/data/concierge/staging/ca-default" -}}
             {{- range $k, $v := .Data.data }}
              export {{$k -}}="{{$v -}}"
            {{- end }}
          {{ end }}
    spec:
      serviceAccountName: concierge
      containers:
      - name:  app
        image: "us.gcr.io/thescore-devops/concierge/core:bb03091271e0663cdcb78a8dd041d115a18d59da"
        imagePullPolicy: IfNotPresent
        command:
          - bash
          - -c
          - source /vault/secrets/concierge && ./bin/core start
        ports:
          - containerPort: 4001
            name: http
          - containerPort: 7700
            name: grpc
          - containerPort: 4369
            name: tcp-epmd
        livenessProbe:
          httpGet:
            path: /liveness
            port: 4001
          initialDelaySeconds: 60
          periodSeconds: 15
          timeoutSeconds: 5
          failureThreshold: 3
          
        readinessProbe:
          httpGet:
            path: /readiness
            port: 4001
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 2
          
        env:
          - name: KUBERNETES_NAMESPACE
            valueFrom:
              fieldRef:
                fieldPath: metadata.namespace
          - name: K8S_POD_IP
            valueFrom:
              fieldRef:
                fieldPath: status.podIP
          - name: APP_NAME
            value: core
          - name: DD_AGENT_APM_PORT
            value: "8126"
          - name: DD_ENV
            valueFrom:
              fieldRef:
                apiVersion: v1
                fieldPath: metadata.labels['tags.datadoghq.com/env']
          - name: DD_SERVICE
            valueFrom:
              fieldRef:
                apiVersion: v1
                fieldPath: metadata.labels['tags.datadoghq.com/service']
          - name: DD_AGENT_HOST
            valueFrom:
              fieldRef:
                apiVersion: v1
                fieldPath: status.hostIP
          - name: DD_ENTITY_ID
            valueFrom:
              fieldRef:
                apiVersion: v1
                fieldPath: metadata.uid
        envFrom:
          - configMapRef:
              name: concierge
        resources:
          limits:
            memory: 2Gi
          requests:
            cpu: "2"
            memory: 1Gi
`))

	require.NoError(t, err)

	hpa, err := p.DecodeResource([]byte(`
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: concierge-core-autoscaler
  namespace: default
spec:
  behavior:
    scaleDown:
      policies:
      - periodSeconds: 30
        type: Pods
        value: 5
      - periodSeconds: 30
        type: Percent
        value: 50
      stabilizationWindowSeconds: 120
    scaleUp:
      policies:
      - periodSeconds: 60
        type: Pods
        value: 5
      - periodSeconds: 60
        type: Percent
        value: 30
      stabilizationWindowSeconds: 90
  maxReplicas: 5
  minReplicas: 4
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: concierge-core
  metrics:
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
`))
	require.NoError(t, err)

	collection := resourcecollection.New()
	collection.Add(hpa)
	collection.Add(deployment)

	targetingHpas := collection.GetHPAsTargettingResource(deployment)

	require.Len(t, targetingHpas, 1)
	require.Equal(t, hpa, targetingHpas[0])
}
