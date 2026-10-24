#!/usr/bin/env node
// Minimal Jev-driven UAT spike against the Expo web target.
//
// Loop: snapshot the page's interactive elements -> ask Jev which one to act
// on next -> execute it -> repeat until a terminal state or step limit ->
// ask Jev to judge whether the goal was met.
//
// Usage:
//   npm run uat:jev -- --goal "solve today's puzzle" --guess "42"
//   npm run uat:jev -- --dry-run          # no JEV_API_KEY needed, picks the
//                                          # first candidate action instead
//                                          # of calling Jev (proves the harness)
//
// Env:
//   WEB_URL       default http://localhost:8090
//   JEV_API_KEY   required unless --dry-run
//   JEV_ENDPOINT  default https://api.typesafe.ai/v1/systemone

import { chromium } from 'playwright';

const args = parseArgs(process.argv.slice(2));
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:8090';
const JEV_ENDPOINT = process.env.JEV_ENDPOINT ?? 'https://api.typesafe.ai/v1/systemone';
const JEV_API_KEY = process.env.JEV_API_KEY;
const MAX_STEPS = 12;
const CONFIDENCE_FLOOR = 0.55;

if (!args.dryRun && !JEV_API_KEY) {
    console.error('JEV_API_KEY is not set. Pass --dry-run to test the harness without it.');
    process.exit(1);
}

// ponytail: field names below (`state`, `questions`, `type: choice/noul`, response
// shape) are inferred from public writeups (MarkTechPost's Jev launch coverage),
// not a confirmed API contract -- there's no public API reference yet. Verify
// against real docs once waitlist access lands; this function is the one place
// to fix if the shape is wrong.
async function askJev(state, questions) {
    const res = await fetch(JEV_ENDPOINT, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${JEV_API_KEY}`,
        },
        body: JSON.stringify({ state, questions }),
    });
    if (!res.ok) {
        throw new Error(`Jev request failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
}

// Tag every visible interactive element with a stable ref and pull a compact
// description Jev (or --dry-run) can pick from. Buttons/links/checkboxes get
// clicked; text inputs get filled with `args.guess`.
async function snapshotActions(page) {
    return page.evaluate(() => {
        const selector = [
            'button',
            'a[href]',
            '[role="button"]',
            '[role="link"]',
            '[role="checkbox"]',
            'input:not([type="hidden"])',
            'textarea',
            '[contenteditable="true"]',
        ].join(',');

        const els = Array.from(document.querySelectorAll(selector)).filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && !el.disabled;
        });

        return els.map((el, i) => {
            const ref = `e${i}`;
            el.setAttribute('data-jev-ref', ref);
            const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
            const isTextInput =
                el.tagName === 'TEXTAREA' ||
                el.getAttribute('contenteditable') === 'true' ||
                (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(el.type));
            const name =
                el.getAttribute('aria-label') ||
                el.textContent?.trim().slice(0, 80) ||
                el.getAttribute('placeholder') ||
                '(unlabeled)';
            return { ref, role, name, isTextInput };
        });
    });
}

async function describeScreen(page) {
    return page.evaluate(() => ({
        url: location.href,
        title: document.title,
        text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 1500),
    }));
}

function isTerminal(screen) {
    return /solved|correct|incorrect|result|gave up|streak/i.test(screen.text) || /\/result/.test(screen.url);
}

async function chooseAction(screen, actions) {
    if (actions.length === 0) return null;

    if (args.dryRun) {
        const pick = actions[0];
        console.log(`  [dry-run] picking ${pick.ref} (${pick.role} "${pick.name}") — no Jev call`);
        return pick;
    }

    const state = `URL: ${screen.url}\nTitle: ${screen.title}\nVisible text: ${screen.text}\n\nGoal: ${args.goal}`;
    const options = actions.map((a) => `${a.ref}: ${a.role} "${a.name}"`);

    const result = await askJev(state, {
        next_action: { type: 'choice', options },
    });
    const answer = result.next_action;
    console.log(
        `  Jev picked ${answer.choice} (p=${answer.probability?.toFixed?.(3) ?? '?'}, confidence=${answer.confidence?.toFixed?.(3) ?? '?'})`,
    );
    if ((answer.confidence ?? 1) < CONFIDENCE_FLOOR) {
        console.log('  confidence below floor — flagging for human review instead of acting');
        return null;
    }
    const ref = answer.choice.split(':')[0].trim();
    return actions.find((a) => a.ref === ref) ?? null;
}

async function judgeOutcome(screen) {
    if (args.dryRun) {
        console.log('  [dry-run] skipping final judgement — no Jev call');
        return;
    }
    const state = `Final URL: ${screen.url}\nFinal visible text: ${screen.text}\n\nGoal: ${args.goal}`;
    const result = await askJev(state, {
        goal_met: { type: 'noul' },
    });
    const { probability, confidence } = result.goal_met;
    console.log(`\nVerdict: goal_met probability=${probability.toFixed(3)} confidence=${confidence.toFixed(3)}`);
    if (confidence < CONFIDENCE_FLOOR) {
        console.log('Low confidence — route to human review.');
        process.exitCode = 2;
    } else if (probability < 0.5) {
        console.log('FAIL');
        process.exitCode = 1;
    } else {
        console.log('PASS');
    }
}

async function main() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(WEB_URL, { waitUntil: 'networkidle' });

    for (let step = 0; step < MAX_STEPS; step++) {
        const screen = await describeScreen(page);
        console.log(`\nStep ${step}: ${screen.url}`);

        if (isTerminal(screen)) {
            console.log('  terminal state reached');
            break;
        }

        const actions = await snapshotActions(page);
        const chosen = await chooseAction(screen, actions);
        if (!chosen) {
            console.log('  no action taken, stopping');
            break;
        }

        const locator = page.locator(`[data-jev-ref="${chosen.ref}"]`);
        if (chosen.isTextInput) {
            await locator.fill(args.guess);
            console.log(`  filled ${chosen.ref} with "${args.guess}"`);
        } else {
            await locator.click();
            console.log(`  clicked ${chosen.ref} (${chosen.role} "${chosen.name}")`);
        }
        await page.waitForTimeout(500);
    }

    const finalScreen = await describeScreen(page);
    await judgeOutcome(finalScreen);
    await browser.close();
}

function parseArgs(argv) {
    const out = { goal: "solve today's puzzle", guess: '42', dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--goal') out.goal = argv[++i];
        else if (argv[i] === '--guess') out.guess = argv[++i];
        else if (argv[i] === '--dry-run') out.dryRun = true;
    }
    return out;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
