# github-git-config-action

Sets any [git-config](https://git-scm.com/docs/git-config#_variables) variable, and configures git
credentials, overriding those set by [checkout](https://github.com/actions/checkout).

```yaml
  - uses: kota65535/github-git-config-action@v4
    with:
      github-token: ${{ secrets.PAT }}  # git credentials. github-host defaults to github.com
      scope: global                     # global (default), local or system
      config: |                         # dotted or nested, scalars only, quote keys with a colon
        user.name: Tomohiko Ozawa
        "url.https://github.com/.insteadOf": "git@github.com:"
```

`scope: global` writes to a file private to the job via `GIT_CONFIG_GLOBAL`, never to
`~/.gitconfig`, so a later job on the same runner cannot read the token. Requires git 2.32+ and
`RUNNER_TEMP`, and fails rather than silently falling back.

**v4 breaking:** variables moved from individual inputs into `config`, and `global` no longer
persists across jobs on the same runner.
