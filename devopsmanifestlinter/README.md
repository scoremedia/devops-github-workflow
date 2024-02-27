# devopsmanifestliner - Find Manifest Problems in the Early

A simple static checker for theScore/Penn deployment manifests (for example, a compiled `helm` chart of the results of a `kustomize` run).

# Dev Environment

To set up a dev environment, [install mise](https://mise.jdx.dev/getting-started.html#quickstart) and run `mise i` in `devopsmanifestlinter/`.

# Build

To build, run:

```
$ cd devopsmanifestlinter/
$ go build
$ ls
...
...
devopsmanifestlinter
```

# Usage

To run, pipe a stream of k8s manifests to `devopsmanifestlinter`:

_Passing tests:_

```
# Compiles a helm chart for concierge
$ concierge_helm () {
    helm template concierge
      ~/src/github.com/scorebet/concierge-manifests/charts/concierge
      --values ~/src/github.com/scorebet/concierge-manifests/values/staging/values-base.yaml
      --values ~/src/github.com/scorebet/concierge-manifests/values/staging/values-scorebet-ca-default-staging.yaml
}

# Perform linting checks
concierge_helm | ./devopsmanifestlinter 

# Looks good!
$ echo $?
0
```

_Failing checks:_

```
# Let's make checks fail (duplicate all resources, including HPAs):
$ { concierge_helm; concierge_helm; } | ./devopsmanifestlinter 
devops-manifest-lint: Deployment concierge-core is targeted by multiple HPAs (concierge-core-autoscaler, concierge-core-autoscaler)
devops-manifest-lint: Deployment concierge-core is targeted by multiple HPAs (concierge-core-autoscaler, concierge-core-autoscaler)

$ echo $?
1
```

# Design

In a nutshell, `devopsmanifestlister` contains a series of checks, which are performed against the provided stream of k8s manifests.  It is up to the user to determine the correct scope of manifests to provide to the tool.  Ideally, it would be run on all of the manifests that comprise a namespace, but depending on how `helm` charts are deployed, can be a useful check of the resources within a compiled `helm` chart. 

- Most of the work is perfomed by `pkg.linter.Linter`
- This type stores a list of `pkg.linter.Check` 's and can perform those checks against a list of k8s resources
- `pkg.k8sparser.Parser` is be used to convert multi-or-single document YAML or JSON k8s manifests to k8s resources

# Contributing

**Testing**

To test, use `go test`.  Unit tests are defined in `_test.go` files throughout the codebase:

```
$ cd devopsmanifestlinter
$ go test ./...
?       devopsmanifestlinter    [no test files]
?       devopsmanifestlinter/pkg/linter [no test files]
ok      devopsmanifestlinter/pkg/k8sparser      0.836s
ok      devopsmanifestlinter/pkg/linter/checks  1.026s
ok      devopsmanifestlinter/pkg/linter/checks/checkhelpers/resourcecollection  1.303s
```

**testify**

To aid with testing, I've pulled in [testify](https://github.com/stretchr/testify). So far, I'm merely using assertions, but it's pretty fantastic testing library that can become more useful as the tool becomes more complicated.

# Bugs

- Only one check is implemented; a check to ensure that no more than one HPA targets a scalable resource.  Just want to get feedback on the general design before adding additional checks.
- Until we start using this, I'll hold off on adding unit tests/builds to this tool's CI.
- The interface is pretty barren since the intention is for this to be run non-interactively within reusable Github workflows used in `-manifest` repos.  We can add a command line interface if there's ever a need to run this interactively.
- Since it'll be run within Github Actions workflows, just note that this tool will likely be enhanced to provide feedback via Github pull requests, perhaps adding comments describing failing tests.
- It's not possible to configure which linting checks are run or to configure checks.  If we get to the point where we've implemented optional checks, we can create a factory that generates a list of checks from a configruation file or command line options.
- Since I'm just throwing this source into a random Github repo, the package name is simply `devopsmanifestlinter`.  If we end up moving this to its own repository, we can rename the package to make the modules more reuable.
- Over time it may become beneficial to provide more detailed output describing failures (e.g. actually emitting resources causing issues).  For the time being, though, I'll keep check output terse to simplify the implementation.
