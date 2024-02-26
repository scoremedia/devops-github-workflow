package main

import (
	"devopsmanifestlinter/pkg/k8sparser"
	"devopsmanifestlinter/pkg/linter"
	"devopsmanifestlinter/pkg/linter/checks"
	"fmt"
	"io"
	"log"
	"os"
)

func main() {
	resourcesBytes, err := io.ReadAll(os.Stdin)

	if err != nil {
		log.Panicf("could not read resources from stdin: %s", err)
	}

	resources, err := k8sparser.NewParser().DecodeResourceStream(resourcesBytes)

	if err != nil {
		log.Panicf("could not unmarshal resources: %s", err)
	}

	linter := linter.NewLinter()

	linter.AddCheck(&checks.SingleHpaPerScalableResource{})
	linter.AddCheck(&checks.NonZeroPodDisruptionBudgets{})
	linter.AddCheck(&checks.AlwaysFails{})

	failures := linter.Validate(resources)

	for _, failure := range failures {
		fmt.Printf("devops-manifest-lint: %s\n", failure)
	}
}
