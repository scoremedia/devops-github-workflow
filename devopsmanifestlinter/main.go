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

	// Now that a check has been actually implemented and can fail, I don't
	// need to include an always failing test.
	//
	// To make the SingleHpaPerScalableResource fail, just pipe in two
	// copies of a compiled helm template with an HPA (the HPA will target
	// the deployment twice).
	//
	// This is also demonstrated in `singlehpaperscalableresource_test.go`.
	//
	// But if you want to verify what happens when tests fail, uncomment
	// the line below.
	//
	// linter.AddCheck(&checks.AlwaysFails{})

	failures := linter.Validate(resources)

	exitStatus := 0

	for _, failure := range failures {
		fmt.Fprintf(os.Stderr, "devops-manifest-lint: %s\n", failure)
		exitStatus = 1
	}

	os.Exit(exitStatus)
}
