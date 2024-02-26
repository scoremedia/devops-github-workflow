package k8sparser

import (
	"bufio"
	"bytes"
	"io"

	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/kubernetes/scheme"
)

type Parser struct {
}

func NewParser() *Parser {
	return &Parser{}
}

// DecodeResource uses the "universal deserializer" to decode k8s resources
// Note that although this supports YAML and JSON, it is not capable of
// decoding a stream of YAML documents (separated by `---`).
func (p *Parser) DecodeResource(data []byte) (interface{}, error) {
	decode := scheme.Codecs.UniversalDeserializer().Decode

	obj, _, err := decode([]byte(data), nil, nil)

	if err != nil {
		return nil, err
	}

	return obj, nil
}

// DecodeResourceStream decodes multi-document YAML stream of k8s resources.
func (p *Parser) DecodeResourceStream(yaml []byte) ([]interface{}, error) {
	yamlReader := utilyaml.NewYAMLReader(bufio.NewReader(bytes.NewReader(yaml)))

	result := []interface{}{}

	for {
		buf, err := yamlReader.Read()

		if err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}

		resource, err := p.DecodeResource(buf)

		if err != nil {
			return nil, err
		}

		result = append(result, resource)
	}

	return result, nil
}
