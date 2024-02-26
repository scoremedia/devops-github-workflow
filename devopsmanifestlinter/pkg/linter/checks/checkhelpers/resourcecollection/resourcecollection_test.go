package resourcecollection_test

import (
	"devopsmanifestlinter/pkg/k8sparser"
	"devopsmanifestlinter/pkg/linter/checks/checkhelpers/resourcecollection"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResourceCollectionFindsHpasTargettingADeployment(t *testing.T) {
	p := k8sparser.NewParser()
	deploymentYaml, err := os.ReadFile("testdata/a_deployment.yaml")
	require.NoError(t, err)

	deployment, err := p.DecodeResource(deploymentYaml)
	require.NoError(t, err)

	hpaYaml, err := os.ReadFile("testdata/an_hpa.yaml")
	require.NoError(t, err)

	hpa, err := p.DecodeResource(hpaYaml)
	require.NoError(t, err)

	collection := resourcecollection.New()
	collection.Add(hpa)
	collection.Add(deployment)

	targetingHpas := collection.GetHPAsTargettingResource(deployment)

	require.Len(t, targetingHpas, 1)
	require.Equal(t, hpa, targetingHpas[0])
}
