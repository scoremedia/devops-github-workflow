package checks

type NonZeroPodDisruptionBudgets struct {
}

func (s *NonZeroPodDisruptionBudgets) Validate(resources []interface{}) (bool, []error) {
	return true, nil
}
