# Calm Glucose Guide (Google Health)

## 📌 Next Steps & Technical Priorities

As part of the push towards the **May 18 MVP** and the start of clinical patient testing, our immediate technical priorities are to resolve current blockers and clean the interface for our senior and T2D demographic on insulin.

### Immediate Focus (The "First Issues")
1. **Reduce Mobile Interface:** Simplify the current UI layout by keeping only three core tabs (`Journey`, `Circle`, `Learn`). We need to hide/remove the extra tabs to prevent overwhelming senior users during testing.
2. **Dexcom Connection Fix:** The `dexcom-auth` function is currently failing. We will pivot to using **Apple Health** as our primary integration path to unblock the MVP, while keeping the Dexcom API setup as a fallback.
3. **Digital Twin Server Connection:** The Digital Twin server endpoint isn't connecting organically. To stabilize this and match the timeline, we will construct the local MCP server wrapper and LLM interpretation layer to handle the twin proxy.

## 📅 Roadmap & Timeline (April 20 - May 18)

Here is the updated timeline for the MVP sprint leading to the May 18 prototype delivery.

```mermaid
gantt
    title MVP Development Timeline (Apr 20 - May 18)
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Week 1 (Apr 20-27) - IRB & Setup
    IRB Approval & 1st Patient Contact   :crit, a1, 2026-04-20, 7d
    Ship Devices (Kehlin to Mirna)       :a2, 2026-04-20, 7d
    iOS Team Account Live                :a3, 2026-04-20, 14d

    section Weeks 1-3 - Technical Core
    MCP Server (Digital Twin Wrapper)    :b1, 2026-04-20, 21d
    LLM Interpretation Layer             :b2, 2026-04-20, 21d
    Mobile UI Reduction (3 Tabs)         :b3, 2026-04-20, 21d
    Voice Interface Build                :b4, 2026-04-20, 21d

    section Weeks 2-3 - Onboarding
    OTP Login (Passwordless)             :crit, c1, 2026-04-27, 14d
    15-min Guided Onboarding Flow        :crit, c2, 2026-04-27, 14d

    section Weeks 2-4 - CGM Integration
    Apple Health Integration (Primary)   :d1, 2026-04-27, 21d
    Dexcom API Fix/Fallback              :d2, 2026-04-27, 21d
    Hands-on Bluetooth Device Testing    :d3, 2026-04-27, 21d

    section Launch
    Working MVP Prototype Deliverable    :milestone, m1, 2026-05-18, 0d
```

---

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
