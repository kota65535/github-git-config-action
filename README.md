# github-git-config-action

GitHub Action for configuring git credentials, username etc.

- All [git-config](https://git-scm.com/docs/git-config#_variables) options are available
- Easily overrides credentials set by [checkout](https://github.com/actions/checkout) action's `persist-credentials`

## Usage

```yaml
  - name: Configure git
    uses: kota65535/github-git-config-action@v4
    with:
      github-token: ${{ secrets.PAT }}    # Use a personal access token as git credentials
      config: |
        user.name: Tomohiko Ozawa
        user.email: kota65535@gmail.com
```

## Inputs

| Name           | Description                                                                                              | Required | Default      |
|----------------|----------------------------------------------------------------------------------------------------------|----------|--------------|
| `config`       | Git config variables to set, written in YAML. See [Config](#config) below                                | No       | N/A          |
| `scope`        | Scope (ex: `global`, `local`).<br>See [here](https://git-scm.com/docs/git-config#SCOPES) for more details | No       | `global`     |
| `github-token` | GitHub personal access token to use as git credentials                                                   | No       | N/A          |
| `github-host`  | GitHub server hostname                                                                                   | No       | `github.com` |

## Config

Any [git config variable](https://git-scm.com/docs/git-config#_variables) can be set through the `config` input.
Keys may be written either in dotted form or nested; both of the following are equivalent.

```yaml
      config: |
        user.name: Tomohiko Ozawa
        user.email: kota65535@gmail.com
```

```yaml
      config: |
        user:
          name: Tomohiko Ozawa
          email: kota65535@gmail.com
```

All values must be scalars. An empty value or a list is rejected as an error.

Keys and values containing a colon must be quoted, as required by YAML.

```yaml
      config: |
        "url.https://github.com/.insteadOf": "git@github.com:"
```

## Migrating from v3

In v3 and earlier, each git config variable was given as its own input.
GitHub emitted an `Unexpected input(s)` warning for every one of them, because they could not be declared in
`action.yml`. In v4 they are passed through the single `config` input instead, which also makes variables containing a
placeholder (ex. `branch.<name>.remote`) usable.

```yaml
  # v3
  - uses: kota65535/github-git-config-action@v3
    with:
      user.name: Tomohiko Ozawa
      user.email: kota65535@gmail.com
      github-token: ${{ secrets.PAT }}

  # v4
  - uses: kota65535/github-git-config-action@v4
    with:
      github-token: ${{ secrets.PAT }}
      config: |
        user.name: Tomohiko Ozawa
        user.email: kota65535@gmail.com
```

`scope`, `github-token` and `github-host` are unchanged.
