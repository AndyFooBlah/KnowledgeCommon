# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in KnowledgeCommon, please report it responsibly.

**Please do not open a public GitHub issue for security vulnerabilities.**

Preferred: use GitHub's private vulnerability reporting — the **"Report a vulnerability"** button under this repository's **Security** tab. It opens a private channel visible only to the maintainer.

Alternatively, email **andrew.brook@fooblah.org**.

Include as much detail as you can:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

We will acknowledge your report within 48 hours and aim to release a fix within 14 days for critical issues.

## Scope

This policy covers the `@andyfooblah/knowledge-common` npm package published from this repository. The library never holds an API key: every Gemini call goes through a consumer-supplied server-side broker, enforced by an ESLint rule and a post-build bundle scan. A report of any path by which the library could bundle or leak a secret, or return unvalidated third-party content in a way that harms consumers, is in scope.
