# Security Policy

## Supported Versions

Only the latest version of GodMode deployed at the live demo URL is actively maintained. Security fixes are applied to `main` and reflected immediately in the hosted build.

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ Yes |
| Older snapshots / forks | ❌ No |

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in this project, report it privately so it can be addressed before public disclosure.

### How to Report

1. **GitHub Private Security Advisory** (preferred)  
   Open a [Private Security Advisory](https://github.com/AntManThePro/godmode/security/advisories/new) directly in this repository. GitHub keeps the report confidential until a fix is released.

2. **Email**  
   If you prefer email, send details to the repository owner via the contact information listed on their [GitHub profile](https://github.com/AntManThePro). Use the subject line: `[SECURITY] GodMode Vulnerability Report`.

### What to Include

Provide as much detail as possible so the issue can be reproduced and fixed quickly:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept code or screenshots are helpful)
- The environment in which you found it (browser, OS, version)
- Any suggested mitigations, if you have them

---

## Response Timeline

| Milestone | Target Timeframe |
|-----------|-----------------|
| Acknowledgement of report | Within **48 hours** |
| Initial assessment & severity triage | Within **5 business days** |
| Fix developed and tested | Within **14 days** for critical/high; **30 days** for medium/low |
| Public disclosure (coordinated) | After fix is deployed, or by mutual agreement |

These are best-effort targets. Complex issues may take longer; you'll be kept informed of progress.

---

## Responsible Disclosure Guidelines

We follow a **coordinated disclosure** model:

- **Give us time.** Please allow a reasonable window (at minimum 14 days) to address the issue before making any public disclosure.
- **No automated scanning abuse.** Do not run aggressive automated scanners or denial-of-service tests against the live demo or any infrastructure tied to this project.
- **No data exfiltration.** If the vulnerability involves accessing data, demonstrate the vulnerability exists without actually reading, storing, or transmitting any data beyond what is necessary.
- **Act in good faith.** Research conducted in a responsible manner, with the goal of improving security, is appreciated and will be treated with respect.
- **Credit.** Researchers who responsibly disclose valid vulnerabilities will be credited in the release notes unless they prefer to remain anonymous.

We will not pursue legal action against researchers who follow these guidelines.

---

## Scope

This project is a **client-side, single-file web application** (HTML + Vanilla JS). The primary security concern areas are:

- Cross-Site Scripting (XSS) via dynamic HTML rendering or `innerHTML` usage
- Malicious data injected into `localStorage` state (`godmode-memory-v2`)
- Third-party CDN supply-chain risks (Tailwind CSS via CDN)
- Insecure content rendered from user-supplied input

Issues in third-party dependencies (e.g., Tailwind CSS CDN) should be reported to those upstream projects directly.

---

## Out of Scope

The following are **not** considered valid security reports for this project:

- Vulnerabilities in the GitHub platform itself
- Bugs with no security impact (use regular [Issues](https://github.com/AntManThePro/godmode/issues) for those)
- Issues requiring physical access to the user's device
- Self-XSS (where the attacker and victim are the same person)

---

*Thank you for helping keep GodMode and its users safe. 🔒*
