# AdmitPilot AI

> **One Candidate Profile. Every University Application.**

All source code lives in [`admitpilot/`](admitpilot/README.md). See that README for setup, and [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) for architecture notes and known issues.

```bash
cd admitpilot
npm install
npm run backend:dev     # http://localhost:3001  (requires JWT_SECRET env var)
npm run dashboard:dev   # http://localhost:5173
npm run extension:build # load admitpilot/apps/extension/dist as unpacked extension
```

Licensed under a custom Non-Commercial License — see [LICENSE](LICENSE).
