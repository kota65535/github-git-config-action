# github-git-config-action

GitHub Action for configuring git credentials, username etc.

- All [git-config](https://git-scm.com/docs/git-config#_variables) options are available
- Easily overrides [checkout](https://github.com/actions/checkout) action's persistent credentials

## Usage

```yaml
  - name: Configure git
    uses: kota65535/github-git-config-action@v1
    with:
      user.name: Tomohiko Ozawa           # Set user.name
      user.email: kota65535@gmail.com     # Set user.email
      github-token: ${{ secrets.PAT }}    # Configure git credentials to use the personal access token
```

## Inputs

| Name                      | Description                                                                                                                     | Required | Default  |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------|----------|----------|
| `scope`                   | Scope (ex: `global`, `local`).<br>See [here](https://git-scm.com/docs/git-config#SCOPES) for more details                       | Yes      | `global` |
| `github-token`            | GitHub Personal Access Token used as git credentials                                                                            | No       | N/A      |
| **Option variable names** | Option variable (ex. `user.name`, `user.email`).<br>See [here](https://git-scm.com/docs/git-config#_variables) for more details | No       | N/A      |
