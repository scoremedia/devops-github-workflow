package checks

type SingleHpaPerScalableResource struct {
}

func (s *SingleHpaPerScalableResource) Validate(resources []interface{}) (bool, error) {
	return true, nil
}
