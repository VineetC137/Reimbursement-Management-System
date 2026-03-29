# Git Workflow

## Why This Matters
The judges are not only checking whether the project works. They also care whether the team built it with shared ownership. That means the Git history should show real contribution from everyone, not one person uploading the whole project.

This repository is expected to stay on `main`, so the process has to be disciplined.

## 1. Branch Policy
- primary working branch: `main`
- no long-lived side branches for normal work
- if a risky experiment is needed, keep it short and merge back quickly

For this project, the working assumption is that the team commits directly to `main` after syncing and testing locally.

## 2. Contribution Rules
- every member must contribute meaningful commits
- each person should own at least one major area they can explain during presentation
- one person may coordinate merges, but everyone should commit their own work
- nobody should commit code they cannot explain

## 3. Expected Ownership Split
Example split:

- Member 1: auth, onboarding, role management
- Member 2: expense submission, history, attachments
- Member 3: approval engine, approval rules, audit flow

This does not prevent collaboration. It just gives the presentation a clear ownership map.

## 4. Commit Timing
Commit after a complete checkpoint, not after every random line change.

Good commit moments:

- after README and architecture docs are finalized
- after database schema and migrations are working
- after auth flow works end to end
- after expense submission works end to end
- after approval queue works end to end
- after validation and polish are added

Avoid:

- huge mixed commits covering unrelated features
- vague messages like `changes`, `update`, `fix work`

## 5. Commit Message Style
Use short, specific messages.

Recommended style:

- `docs: add project architecture and local setup guides`
- `feat: add company onboarding and admin signup flow`
- `feat: implement expense submission with currency normalization`
- `feat: add sequential and hybrid approval workflow`
- `fix: block invalid approval rule combinations`
- `style: refine dashboard spacing and status colors`

## 6. Daily Working Routine
Suggested flow for each member:

1. pull latest `main`
2. make one focused chunk of progress
3. test locally
4. commit with a meaningful message
5. push to `main`
6. inform the team what changed if it affects others

## 7. Conflict Prevention
Since the team is using `main`, coordination matters.

Rules:

- announce when working on shared files like Prisma schema or common API types
- keep commits frequent so conflicts stay small
- pull before starting work and before pushing
- resolve conflicts carefully, especially in schema, routes, and shared UI components

## 8. Presentation Readiness
Before the final submission:

- review commit history as a team
- make sure every member has visible contribution
- make sure each member can explain the logic behind their commits
- prepare short talking points from commit history for demo day

## 9. What Good Team History Looks Like
Good history should show:

- early planning and documentation
- database-first development
- feature implementation in logical order
- bug fixes and validation improvements
- UI refinement near the end

That tells a much better story than one final upload.

## 10. Minimum Standard for This Repo
At the very least, the final repo history should prove:

- more than one contributor actually worked on it
- the project evolved in clear stages
- major technical decisions were made intentionally
- the team understood what they committed
