# Security policy

## Reporting

Report suspected vulnerabilities privately to the maintainer rather than opening
a public issue. Please include a description, affected versions, and a
reproduction.

## Trust model (summary)

The full trust model is in [docs/SECURITY.md](docs/SECURITY.md). In brief:

- Verification terminates in a validated **Bitcoin (BSV) block-header chain**. No
  service component is ever a trust root.
- The **proof store is availability-only**. A misbehaving store that withholds or
  returns a wrong fragment surfaces as a verification *failure*, never as a false
  acceptance.
- **Selective disclosure** is the privacy mechanism, provided by proof-sharding.
  There is no hidden-value cryptography.
- The **trusted-operational mode is not adversarially sound** and is never
  accepted by the audit verification path.

## Supported versions

The `main` branch is supported. Releases are semantic version tags.
