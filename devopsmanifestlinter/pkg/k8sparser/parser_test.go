package k8sparser_test

import (
	"devopsmanifestlinter/pkg/k8sparser"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/api/apps/v1"
)

func TestParseDeployment(t *testing.T) {
	deploymentYaml, err := os.ReadFile("testdata/a_deployment.yaml")
	require.NoError(t, err)

	p := k8sparser.NewParser()
	res, err := p.DecodeResource(deploymentYaml)
	require.NoError(t, err)
	require.IsType(t, &v1.Deployment{}, res)
}

func TestParseDeploymentStream(t *testing.T) {
	deploymentYaml, err := os.ReadFile("testdata/two_deployments.yaml")
	require.NoError(t, err)

	p := k8sparser.NewParser()
	resources, err := p.DecodeResourceStream(deploymentYaml)
	require.NoError(t, err)

	for _, resource := range resources {
		require.IsType(t, &v1.Deployment{}, resource)
	}
}
