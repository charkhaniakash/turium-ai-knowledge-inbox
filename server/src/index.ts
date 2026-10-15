import { buildApp } from './app';

// Port defaults to 4000; full env parsing via config.ts is added in Phase 2.
const PORT = process.env['PORT'] ?? '4000';

const app = buildApp();

app.listen(Number(PORT), () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
