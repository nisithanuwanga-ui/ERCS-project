import type { DemoAccount } from "../backend/src/seed-demo.js";
// Public fictional credentials are confined to explicit development tooling.
// scripts/ is not included in the production API compilation or image.
export const demoAccounts: ReadonlyArray<DemoAccount> = [
  {
    email: "admin@ercs.demo",
    password: "DemoAdmin2026!",
    name: "Demo Administrator",
    role: "administrator",
  },
  {
    email: "coordinator@ercs.demo",
    password: "DemoCoord2026!",
    name: "Demo Coordinator",
    role: "coordinator",
  },
  {
    email: "resources@ercs.demo",
    password: "DemoResource2026!",
    name: "Demo Resource Manager",
    role: "resource_manager",
  },
  {
    email: "officer@ercs.demo",
    password: "DemoOfficer2026!",
    name: "Demo Field Officer",
    role: "field_officer",
  },
  {
    email: "viewer@ercs.demo",
    password: "DemoViewer2026!",
    name: "Demo Authorized Viewer",
    role: "viewer",
  },
];
