// Package linter allows users to run linting checks against a list of
// kubernetes resources
package linter

type Check interface {
	Validate(resources []interface{}) (bool, error)
}

// A Linter is a type that can run a list of checks against lists of
// Kubernetes resources
type Linter struct {
	checks []Check
}

// NewLinter returns a new linter
func NewLinter() *Linter {
	return &Linter{}
}

// Adds a check to this linter
func (l *Linter) AddCheck(c Check) {
	l.checks = append(l.checks, c)
}

// Validate runs all added checks against the provided list of Kubernetes
// resources.  The result is a list of errors describing failed checks.
func (l *Linter) Validate(resources []interface{}) []error {
	collectedErrors := []error{}

	for _, check := range l.checks {
		if ok, err := check.Validate(resources); !ok {
			collectedErrors = append(collectedErrors, err)
		}
	}

	return collectedErrors
}
