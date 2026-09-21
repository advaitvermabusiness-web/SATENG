---
name: GitHub empty repository uploads
description: The GitHub REST Git data API rejects blob creation against a completely empty repository.
---

When transferring a project to an empty GitHub repository, create the first file and commit through the repository Contents API, then use the established branch for additional uploads or Git data operations.

**Why:** GitHub returned a 409 “Git Repository is empty” response for direct blob creation even though the authenticated connection had repository write permission.

**How to apply:** Check whether the target repository has a branch first. If it is empty, seed `main` with a real file using `PUT /repos/{owner}/{repo}/contents/{path}` before creating trees, commits, or refs.