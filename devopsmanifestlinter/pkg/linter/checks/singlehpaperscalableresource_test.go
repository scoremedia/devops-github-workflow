package checks_test

import (
	"devopsmanifestlinter/pkg/k8sparser"
	"devopsmanifestlinter/pkg/linter/checks"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSingleHpaPerScalableResourceFailsWhenResourceIsDoublyTargeted(t *testing.T) {
	p := k8sparser.NewParser()

	deploymentYaml, err := os.ReadFile("testdata/a_deployment.yaml")
	require.NoError(t, err)

	deployment, err := p.DecodeResource(deploymentYaml)
	require.NoError(t, err)

	hpaYaml, err := os.ReadFile("testdata/an_hpa.yaml")
	require.NoError(t, err)

	hpa, err := p.DecodeResource(hpaYaml)
	require.NoError(t, err)

	check := &checks.SingleHpaPerScalableResource{}

	ok, errs := check.Validate([]interface{}{
		hpa,
		hpa,
		deployment,
	})

	require.False(t, ok)
	require.NotEmpty(t, errs)
}

func TestSingleHpaPerScalableResourcePassesWhenResourcesAreSinglyTargeted(t *testing.T) {
	p := k8sparser.NewParser()

	deploymentYaml, err := os.ReadFile("testdata/a_deployment.yaml")
	require.NoError(t, err)

	deployment, err := p.DecodeResource(deploymentYaml)
	require.NoError(t, err)

	hpaYaml, err := os.ReadFile("testdata/an_hpa.yaml")
	require.NoError(t, err)

	hpa, err := p.DecodeResource(hpaYaml)
	require.NoError(t, err)

	check := &checks.SingleHpaPerScalableResource{}

	ok, errs := check.Validate([]interface{}{
		hpa,
		deployment,
	})

	require.True(t, ok)
	require.Empty(t, errs)
}

func TestSingleHpaPerScalableResourcePassesWhenResourcesAreNotTargeted(t *testing.T) {
	p := k8sparser.NewParser()

	deploymentYaml, err := os.ReadFile("testdata/a_deployment.yaml")
	require.NoError(t, err)

	deployment, err := p.DecodeResource(deploymentYaml)
	require.NoError(t, err)

	check := &checks.SingleHpaPerScalableResource{}

	ok, errs := check.Validate([]interface{}{
		deployment,
	})

	require.True(t, ok)
	require.Empty(t, errs)
}
