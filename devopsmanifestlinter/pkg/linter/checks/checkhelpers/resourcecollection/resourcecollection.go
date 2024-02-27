package resourcecollection

import (
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type hpaTarget struct {
	kind       string
	name       string
	apiVersion string
}

// A ResourceCollection holds a set of k8s resources and can efficiently answer
// questions on the collection.
type ResourceCollection struct {
	// Indexes HPAs by their target.
	hpasByTarget map[hpaTarget][]*autoscalingv2.HorizontalPodAutoscaler
}

func New() *ResourceCollection {
	return &ResourceCollection{
		hpasByTarget: map[hpaTarget][]*autoscalingv2.HorizontalPodAutoscaler{},
	}
}

func (r *ResourceCollection) Add(resource interface{}) {
	switch resource := resource.(type) {
	case *autoscalingv2.HorizontalPodAutoscaler:
		target := hpaTarget{
			kind:       resource.Spec.ScaleTargetRef.Kind,
			name:       resource.Spec.ScaleTargetRef.Name,
			apiVersion: resource.Spec.ScaleTargetRef.APIVersion,
		}

		r.hpasByTarget[target] = append(r.hpasByTarget[target], resource)
	}
}

type Resource interface {
	GetObjectKind() schema.ObjectKind
	GetName() string
}

func (r *ResourceCollection) GetHPAsTargettingResource(targetResource interface{}) []*autoscalingv2.HorizontalPodAutoscaler {
	return r.hpasByTarget[hpaTarget{
		kind:       targetResource.(Resource).GetObjectKind().GroupVersionKind().Kind,                    // e.g. Deployment
		name:       targetResource.(Resource).GetName(),                                                  // e.g. concierge-core
		apiVersion: targetResource.(Resource).GetObjectKind().GroupVersionKind().GroupVersion().String(), // e.g. apps/v1
	}]

}
