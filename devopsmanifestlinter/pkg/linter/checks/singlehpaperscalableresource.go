package checks

import (
	"devopsmanifestlinter/pkg/linter/checks/checkhelpers/resourcecollection"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

type SingleHpaPerScalableResource struct {
}

func (s *SingleHpaPerScalableResource) Validate(resources []interface{}) (bool, []error) {
	var errs []error

	resourceCollection := resourcecollection.New()

	for _, resource := range resources {
		resourceCollection.Add(resource)
	}

	for _, resource := range resources {
		targettingHPAs := resourceCollection.GetHPAsTargettingResource(resource)

		if len(targettingHPAs) > 1 {
			hpaNames := []string{}

			for _, hpa := range targettingHPAs {
				hpaNames = append(hpaNames, hpa.Name)
			}

			errs = append(errs, fmt.Errorf(
				"%s %s is targetted by multiple HPAs (%s)",
				resource.(Resource).GetObjectKind().GroupVersionKind().Kind,
				resource.(Resource).GetName(),
				strings.Join(hpaNames, ", "),
			))
		}
	}

	return len(errs) == 0, errs
}

type Resource interface {
	GetObjectKind() schema.ObjectKind
	GetName() string
}
