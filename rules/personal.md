# Chowderr's businesses — facts and standing decisions

Facts about how Chowderr's businesses work that apply in every project. Retrieve these, never re-derive them.

## Otaku Solutions positioning
- Quote the company sentence as written, never reword it: "Otaku Solutions is an automation and AI agency that educates, consults, and develops internal tools and automated workflows for businesses and organizations." Automation always comes before AI.
- Chowderr's title is CTAO. To a client they serve as fractional Chief Automation Officer and/or CTO; that is a role, not a service name.
- Never derive a lead service, label, ICP or anti-ICP, because derived positioning reads plausible and is wrong. Retrieve offers from [[Service Model]] (canonical) and the live site, then ask which rung the channel targets.
- Education, Consulting and Development are three separate hourly services; one block of hours spans any of them. The Retainer is a level above, not the three combined.
- Consulting on what a client wants to build is never refused. An anti-ICP needs a recorded refusal; without one, leave it out.
- Channel split: otakusolutions.io leads "Educate · Consult · Build" in that order; the Upwork profile leads the Build rung, because Upwork is a done-for-you marketplace where training does not sell.
- Course, cohort and program page content is modeled on 9x's live pages (see [[9x Site Audit 2026-09]]), never on old vault drafts such as the Savant Vibe Coding course or the "Building Agents with Claude Code" PRD.
- Claude Code Challenge (30 Days of Claude Code) is not a course, not education and not an Otaku product. Keep it out of every catalogue, ladder, pricing table, funnel and CRM tag; fix any note that lists it.
- College CE outreach is teaching only, never lead generation. Judge targets on teaching fit, pay model and deadlines; build syllabi from the programs in Education.md; find direct phone numbers and emails, since Chowderr contacts colleges personally.

## How Chowderr builds
- Ship a small self-contained proof of concept first, then fold its proven pieces into the platform product (Tsukuri folds into Provisr). Keep the small version simple and portable; when projects overlap, name the consolidation path.
- Work comes from beads (and Slack for Factory), never GitHub Issues; ignore GitHub-issue intake when judging tools. A settings rule denies creating GitHub issues.
- Retainer client comms will be self-built. Never propose Discord, Slack or any per-seat chat tool for client channels, because seat-metered client access is the rejected model. The Discord servers in `2. Areas/Communities` are member communities, a separate system.

## Client-owned infrastructure
- Client resources (buckets, tokens, DNS, secrets, apps) go in the client's own account, because the client owns what was built for them. The client is owner/admin; Chowderr (admin@otakusolutions.io) is an invited Admin member, and CLI tokens come from that member account. Check which account a tool reaches first; older resources on Otaku accounts are migration leftovers.

## Hosting and accounts
- The VPS (191.101.15.236) is on Hostinger, never Hetzner. Correct "Hetzner" wherever it appears.
- Otaku's recommended setup for content and media clients: Hostinger VPS KVM 2 (smaller plans fail on updates) via the referral link `https://www.hostinger.com?REFERRALCODE=QTPADMINQ2G5`; Cloudflare R2 for S3-compatible storage; n8n or scripts on the server for workflows. Never list DigitalOcean. Google Cloud Run no longer has a ~5-minute job limit.
- Otaku's Stripe account is `acct_1LOm6xCNzoz7DmNO` ("Otaku Solutions"). Before trusting any figure, run `stripe get /v1/account --live` from PowerShell and read `business_profile.name`, because the CLI was once logged into a client account and wrong-account numbers produce confident wrong answers.
