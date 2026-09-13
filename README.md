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
| `scope`        | Scope to write to (`global`, `local`, `system`). See [Scope](#scope) below                                | No       | `global`     |
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

## Scope

`scope` selects where the config is written. It accepts `global` (the default), `local` and
`system`.

`local` and `system` map directly to the
[git config scopes](https://git-scm.com/docs/git-config#SCOPES) of the same name.

`global` does **not** write to `~/.gitconfig`. Instead, the action creates a config file private to
the current job under `RUNNER_TEMP` with mode `0600`, and points `GIT_CONFIG_GLOBAL` at it. git
then treats that file as the global config for the rest of the job. See
[Migrating from v3](#migrating-from-v3) if you relied on the previous behaviour.

This matters most on long-lived self-hosted runners:

- The token is never written to `~/.gitconfig`, so a later job on the same runner cannot read it.
  `GIT_CONFIG_GLOBAL` is exported through `GITHUB_ENV`, which only applies to the remaining steps
  of the current job.
- The token is never written to `.git/config` either, so nothing is left behind in a reused
  workspace.
- Concurrent jobs on the same runner each get their own file, so they no longer race on a shared
  `~/.gitconfig`.
- Only the path is placed in the environment, never the token itself, so the token does not appear
  in process arguments or in process audit logs.
- Unlike `local`, the config still applies to every repository the job touches, including
  submodules and repositories cloned by tools such as `go mod`.

Cleanup does not have to succeed for any of this to hold: a cancelled or killed job may leave the
file behind, but no later job has `GIT_CONFIG_GLOBAL` pointing at it, and the runner clears
`RUNNER_TEMP` when the next job starts.

The pre-existing global config is pulled in with an `include` directive, so settings already
present on the runner, such as the `safe.directory` entries written by the
[checkout](https://github.com/actions/checkout) action, keep working.

`GIT_CONFIG_GLOBAL` was introduced in **git 2.32** (released 2021-06-06). Older versions ignore it
and would silently write the token to `~/.gitconfig` instead, so the action fails rather than
falling back. Upgrade git, or use `scope: local` if the config only needs to apply to the checked
out repository.

`global` also requires the `RUNNER_TEMP` environment variable, which GitHub Actions always sets.
Tools that emulate Actions locally may not, in which case use `scope: local`.

## Migrating from v3

### `scope: global` no longer writes to `~/.gitconfig`

**This is a breaking change.** `global` is the default scope, so this applies unless you set
`scope` explicitly.

In v3 and earlier, `global` wrote to `~/.gitconfig`, which persists for the lifetime of the runner.
On a self-hosted runner that meant the token stayed readable by every later job, and the post step
that unset it was best-effort: a cancelled or killed job never ran it. v4 writes to a job-local
file instead. See [Scope](#scope) for the details.

Two consequences:

- Config set by this action no longer carries over to **other jobs** on the same runner. If you
  were relying on that, set the config in each job that needs it. Within a single job, every
  subsequent step is unaffected.
- The runner now needs **git 2.32 or later**. The action fails on older versions rather than
  silently writing the token to `~/.gitconfig`.

`local` and `system` are unchanged.

### Git config variables moved to the `config` input

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

The `github-token` and `github-host` inputs are unchanged. For `scope`, see the section above.
