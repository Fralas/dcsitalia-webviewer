# Contributing to DCS Italia Warehouse Viewer

Thank you for considering a contribution! This project is maintained by and for the DCS community, and we welcome pull requests, issue reports, and suggestions.

## How to Get Started
- **Check existing issues** to avoid duplicates and comment if you want to help.
- **Open a new issue** for bug reports or feature proposals. Include steps to reproduce bugs or a clear description of the desired behavior.
- **Create a fork** of the repository and work from a feature branch (e.g., `feature/add-new-airport`).

## Development Workflow
1. Install dependencies:
   - `npm install` (root) for backend and shared tools
   - `cd frontend && npm install` for the React client
2. Start the development environment with hot reload: `npm run dev`.
3. Add or update tests where applicable and ensure existing tests pass.
4. Keep commits focused and write clear commit messages.
5. Open a pull request that describes the change, testing steps, and any configuration updates.

## Coding Guidelines
- Use existing project patterns and naming conventions for React components and Express services.
- Avoid try/catch wrappers around imports; handle errors within the code that uses the imported modules.
- Keep documentation updates alongside feature changes when relevant.

## Documentation & Examples
- Update `README.md` when behavior, setup, or configuration changes.
- Add examples or comments for new configuration options in `backend/src/config`.
- Include screenshots for UI changes when helpful.

## Code of Conduct
By participating, you agree to maintain a respectful and constructive environment for all contributors and users.
