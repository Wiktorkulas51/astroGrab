import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.ASTRO_GRAB_QA_URL ?? 'http://localhost:4321/';
const ORIGIN = new URL(BASE_URL).origin;

const systemBrowser = findBrowserExecutable();

if (!systemBrowser) {
  throw new Error(
    [
      'No browser executable found for headless QA.',
      'Set CHROME_EXECUTABLE_PATH or PLAYWRIGHT_EXECUTABLE_PATH, or install Chrome/Edge locally.',
      'Checked common Windows paths for Chrome and Edge.',
    ].join(' ')
  );
}

const browser = await chromium.launch({
  headless: true,
  executablePath: systemBrowser,
});

const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
});

await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });

try {
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  const frame = await getPreviewFrame(page);
  await frame.locator('h1').first().waitFor({ state: 'visible' });
  const clipboardEnv = await page.evaluate(() => ({
    secure: window.isSecureContext,
    execCommand: typeof document.execCommand,
    clipboardWrite: typeof navigator.clipboard?.writeText,
  }));
  console.log(`Clipboard env: ${JSON.stringify(clipboardEnv)}`);
  await page.evaluate(() => {
    const state = {
      fetchCalls: [],
      clipboardWrites: [],
      execCommands: [],
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      state.fetchCalls.push(String(args[0]));
      const response = await originalFetch(...args);
      return response;
    };
    const clipboard = navigator.clipboard;
    if (clipboard?.writeText) {
      const originalWriteText = clipboard.writeText.bind(clipboard);
      clipboard.writeText = async (text) => {
        state.clipboardWrites.push(String(text).length);
        return originalWriteText(text);
      };
    }
    const originalExecCommand = document.execCommand.bind(document);
    document.execCommand = (command) => {
      state.execCommands.push(command);
      return originalExecCommand(command);
    };
    window.__astroGrabQaState = state;
  });
  const frameQaState = await frame.evaluate(() => {
    const state = {
      fetchCalls: [],
      clipboardWrites: [],
      execCommands: [],
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      state.fetchCalls.push(String(args[0]));
      const response = await originalFetch(...args);
      return response;
    };
    const clipboard = navigator.clipboard;
    if (clipboard?.writeText) {
      const originalWriteText = clipboard.writeText.bind(clipboard);
      clipboard.writeText = async (text) => {
        state.clipboardWrites.push(String(text).length);
        return originalWriteText(text);
      };
    }
    const originalExecCommand = document.execCommand.bind(document);
    document.execCommand = (command) => {
      state.execCommands.push(command);
      return originalExecCommand(command);
    };
    window.__astroGrabQaState = state;
    return state;
  });
  console.log(`QA state initialized: ${JSON.stringify(frameQaState)}`);
  const clipboardProbe = await page.evaluate(async () => {
    const results = {};

    try {
      await navigator.clipboard.writeText('astro-grab-probe');
      results.writeText = 'ok';
    } catch (error) {
      results.writeText = error instanceof Error ? error.message : String(error);
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = 'astro-grab-probe';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      results.execCommand = document.execCommand('copy') ? 'ok' : 'false';
      textarea.remove();
    } catch (error) {
      results.execCommand = error instanceof Error ? error.message : String(error);
    }

    return results;
  });
  console.log(`Clipboard probe: ${JSON.stringify(clipboardProbe)}`);

  await runScenario(page, frame, {
    name: 'hero heading',
    selector: 'h1:visible',
    expectLabel: (label) => label.startsWith('h1'),
    expectClipboard: (text) => {
      assert.match(text, /ELEMENT\s*\nh1/);
      assert.match(text, /PATH\s*/);
      assert.match(text, /SOURCE\s*\nfile: .*Hero\.astro/);
      assert.match(text, /SNIPPET\s*\n```astro/);
    },
  });

  await runScenario(page, frame, {
    name: 'hero description',
    selector: 'p.hero-description:visible',
    expectLabel: (label) => label.startsWith('p.hero-description'),
    expectClipboard: (text) => {
      assert.match(text, /ELEMENT\s*\np/);
      assert.match(text, /hero-description/);
      assert.equal(countOccurrences(text, 'INSTRUCTION'), 1);
      assert.equal(text.includes('outerHTML'), false);
    },
  });

  await runScenario(page, frame, {
    name: 'cta gap',
    getPoint: async (frameRef) => {
      const left = await frameRef.locator('a:has-text("Zacznij teraz"):visible').first().boundingBox();
      const right = await frameRef.locator('a:has-text("Dowiedz się więcej"):visible').first().boundingBox();
      assert(left && right, 'Expected CTA links to be present');

      const gapStart = left.x + left.width;
      const gapEnd = right.x;
      return {
        x: gapStart + Math.max(4, (gapEnd - gapStart) / 2),
        y: left.y + left.height / 2,
      };
    },
    expectLabel: (label) => label.startsWith('div.flex.flex-wrap'),
    expectClipboard: (text) => {
      assert.match(text, /ELEMENT\s*\ndiv/);
      assert.match(text, /hero-btns/);
      assert.match(text, /SOURCE\s*\nfile: .*Hero\.astro/);
      assert.equal(countOccurrences(text, 'INSTRUCTION'), 1);
    },
  });

  await runScenario(page, frame, {
    name: 'image target',
    selector: 'img[alt="AiStudio Dashboard Preview"]:visible',
    expectLabel: (label) => label.startsWith('img'),
    expectClipboard: (text) => {
      assert.match(text, /ELEMENT\s*\nimg/);
      assert.match(text, /AiStudio Dashboard Preview/);
    },
  });

  await runWheelScenario(page, frame);

  console.log('Headless targeting QA passed.');
} finally {
  await browser.close();
}

async function runScenario(page, frame, scenario) {
  const snippetResponses = [];
  const requestFailures = [];
  const onResponse = (response) => {
    if (response.url().includes('/__astro-grab/snippet')) {
      snippetResponses.push({ status: response.status(), url: response.url() });
    }
  };
  const onRequestFailed = (request) => {
    if (request.url().includes('/__astro-grab/snippet')) {
      requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' });
    }
  };

  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);

  try {
    const point = scenario.getPoint ? await scenario.getPoint(frame) : await centerOf(frame.locator(scenario.selector).first());

    await page.keyboard.down('Alt');
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(150);

    const label = await readOverlayLabel(frame);
    assert.ok(scenario.expectLabel(label), `Unexpected overlay label for ${scenario.name}: ${label}`);

    await page.mouse.down();
    await waitForCopyOutcome(frame);
    await page.mouse.up();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    scenario.expectClipboard(clipboard);

    assert.equal(requestFailures.length, 0, `Snippet request failed for ${scenario.name}: ${JSON.stringify(requestFailures)}`);
    assert.equal(snippetResponses.length > 0, true, `No snippet response observed for ${scenario.name}`);
    assert.equal(snippetResponses[0].status, 200, `Snippet response was not 200 for ${scenario.name}: ${JSON.stringify(snippetResponses)}`);
  } catch (error) {
    let snippetBody = null;
    if (snippetResponses[0]?.url) {
      try {
        snippetBody = await page.evaluate(async (url) => {
          const response = await fetch(url);
          return {
            status: response.status,
            text: (await response.text()).slice(0, 500),
          };
        }, snippetResponses[0].url);
      } catch (probeError) {
        snippetBody = { error: probeError instanceof Error ? probeError.message : String(probeError) };
      }
    }

    const livePageQaState = await page.evaluate(() => window.__astroGrabQaState ?? null);
    const liveFrameQaState = await frame.evaluate(() => window.__astroGrabQaState ?? null);
    const overlayError = await frame.locator('#astro-grab-overlay').getAttribute('data-last-error');

    const details = {
      snippetResponses,
      requestFailures,
      snippetBody,
      livePageQaState,
      liveFrameQaState,
      overlayError,
    };
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${scenario.name} failed: ${message}\n${JSON.stringify(details, null, 2)}`);
  } finally {
    await page.keyboard.up('Alt');
    page.off('response', onResponse);
    page.off('requestfailed', onRequestFailed);
  }
}

async function runWheelScenario(page, frame) {
  const point = await centerOf(frame.locator('h1:visible').first());

  await page.keyboard.down('Alt');
  try {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(150);
    assert.ok((await readOverlayLabel(frame)).startsWith('h1'));

    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(150);
    const parentLabel = await readOverlayLabel(frame);
    assert.match(parentLabel, /group\/field|hero-content/);

    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(150);
    const childLabel = await readOverlayLabel(frame);
    assert.ok(childLabel.startsWith('h1'));
  } finally {
    await page.keyboard.up('Alt');
  }
}

async function readOverlayLabel(frame) {
  return (await frame.locator('#astro-grab-label').textContent()) ?? '';
}

async function waitForCopyOutcome(frame) {
  await frame.waitForFunction(() => {
    const label = document.querySelector('#astro-grab-label');
    const text = label?.textContent ?? '';
    return text.includes('COPIED') || text.includes('ERROR');
  }, null, { timeout: 5000 });

  const label = await readOverlayLabel(frame);
  assert.ok(!label.includes('ERROR'), `Copy failed: ${label}`);
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  assert(box, 'Expected target element to have a bounding box');
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function getPreviewFrame(page) {
  const iframe = page.locator('iframe[title="Studio preview"]');
  await iframe.waitFor({ state: 'visible' });

  const handle = await iframe.elementHandle();
  assert(handle, 'Preview iframe is missing');

  const frame = await handle.contentFrame();
  assert(frame, 'Preview iframe frame is unavailable');
  return frame;
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function findBrowserExecutable() {
  const envCandidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    process.env.MSEDGE_EXECUTABLE_PATH,
  ].filter(Boolean);

  for (const candidate of envCandidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  const commonPaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ];

  for (const candidate of commonPaths) {
    if (existsSync(candidate)) return candidate;
  }

  return findViaWhere('chrome') ?? findViaWhere('msedge');
}

function findViaWhere(command) {
  try {
    const result = execFileSync('where.exe', [command], { encoding: 'utf8' });
    const first = result.split(/\r?\n/).find(Boolean);
    return first && existsSync(first) ? first.trim() : null;
  } catch {
    return null;
  }
}
