package k8sparser_test

import (
	"devopsmanifestlinter/pkg/k8sparser"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/api/apps/v1"
)

func TestParseDeployment(t *testing.T) {
	deploymentYaml := `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
`

	p := k8sparser.NewParser()
	res, err := p.DecodeResource([]byte(deploymentYaml))
	require.NoError(t, err)
	require.IsType(t, &v1.Deployment{}, res)
}

func TestParseDeploymentStream(t *testing.T) {
	deploymentYaml := `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
`

	p := k8sparser.NewParser()
	resources, err := p.DecodeResourceStream([]byte(deploymentYaml))
	require.NoError(t, err)

	for _, resource := range resources {
		require.IsType(t, &v1.Deployment{}, resource)
	}
}
