package checks

import "errors"

type AlwaysFails struct {
}

func (s *AlwaysFails) Validate(resources []interface{}) (bool, error) {
	return false, errors.New("This check will always fail, and is used to test the linter.")
}
