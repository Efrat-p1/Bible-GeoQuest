# Rules

- **Git Operations:** The agent should NEVER run `git commit` or `git push` commands directly. Committing and pushing code to the repository is strictly the responsibility of the user. If a commit or push is required or requested, the agent should propose the appropriate `git` commands (e.g., `git add . && git commit -m "..."`) as a snippet for the user to execute manually.
