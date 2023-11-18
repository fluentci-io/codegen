package denogenerator

import (
	"bytes"
	"context"
	"sort"

	"github.com/fluentci-io/codegen/generator"
	"github.com/fluentci-io/codegen/generator/deno/templates"
	"github.com/fluentci-io/codegen/introspection"
	"github.com/psanford/memfs"
)

const ClientGenFile = ".fluentci/sdk/client.gen.ts"

type DenoGenerator struct {
	Config generator.Config
}

// Generate will generate the NodeJS SDK code and might modify the schema to reorder types in a alphanumeric fashion.
func (g *DenoGenerator) Generate(_ context.Context, schema *introspection.Schema) (*generator.GeneratedState, error) {
	generator.SetSchema(schema)

	sort.SliceStable(schema.Types, func(i, j int) bool {
		return schema.Types[i].Name < schema.Types[j].Name
	})
	for _, v := range schema.Types {
		sort.SliceStable(v.Fields, func(i, j int) bool {
			in := v.Fields[i].Name
			jn := v.Fields[j].Name
			switch {
			case in == "id" && jn == "id":
				return false
			case in == "id":
				return true
			case jn == "id":
				return false
			default:
				return in < jn
			}
		})
	}

	tmpl := templates.New()
	var b bytes.Buffer
	err := tmpl.ExecuteTemplate(&b, "api", schema.Types)
	if err != nil {
		return nil, err
	}

	mfs := memfs.New()

	if err := mfs.MkdirAll(".fluentci/sdk", 0755); err != nil {
		return nil, err
	}

	if err := mfs.WriteFile(ClientGenFile, b.Bytes(), 0600); err != nil {
		return nil, err
	}

	return &generator.GeneratedState{
		Overlay: mfs,
	}, nil
}
