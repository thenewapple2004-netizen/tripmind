/**
 * End-to-end test of the full workflow: browser -> client -> Trip Service -> Postgres.
 *
 * Drives a real Chrome against the running Docker Compose stack and, after every write,
 * checks the database directly with psql. Failure paths (422, 500, network down, slow
 * responses) are simulated by intercepting requests in the browser.
 *
 * Prerequisites: `docker compose up -d` and at least one trip in the database
 * (e.g. `docker compose exec trip-service python -m app.scripts.seed_demo`).
 * Run from the client folder:  npm run test:e2e
 *
 * Optional environment variables:
 *   BASE_URL         client URL                      (default http://localhost:5173)
 *   CHROME_PATH      Chrome/Chromium executable      (default: the installed Google Chrome)
 *   SCREENSHOT_DIR   save screenshots to this folder (default: off)
 *   POSTGRES_USER / POSTGRES_DB                      (default postgres / tripmind_trips)
 *
 * It creates trips titled "E2E ..." and removes them again, even if a check fails.
 */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const BASE = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const SHOTS = process.env.SCREENSHOT_DIR
const DB_USER = process.env.POSTGRES_USER ?? 'postgres'
const DB_NAME = process.env.POSTGRES_DB ?? 'tripmind_trips'
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

const shot = (page, name, options = {}) =>
  SHOTS ? page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...options }) : undefined

const psql = (sql) =>
  execSync(`docker compose exec -T postgres psql -U ${DB_USER} -d ${DB_NAME} -tAc "${sql}"`, {
    cwd: REPO_ROOT,
  })
    .toString()
    .trim()

let passed = 0
const failures = []
const check = (name, condition, detail = '') => {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failures.push(name)
    console.log(`  FAIL ${name} ${detail}`)
  }
}
const section = (title) => console.log(`\n== ${title}`)

/** Polls until `fn` is truthy; UI updates land a render after the action that caused them. */
const until = async (fn, ms = 5000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if (await fn()) return true
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}

const CARDS = 'ul a[href^="/trips/"]'

const baseline = Number(psql('select count(*) from trips'))
console.log('DB trips before:', baseline)
if (baseline === 0) {
  console.error('The database has no trips. Seed it first (see the prerequisites above).')
  process.exit(2)
}

const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, headless: true }
    : { channel: 'chrome', headless: true },
)
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))

const requests = []
page.on('request', (request) => {
  if (request.url().includes('/api/')) {
    requests.push({ method: request.method(), url: request.url(), body: request.postData() })
  }
})
const lastRequest = (method) => requests.filter((r) => r.method === method).at(-1)
const countRequests = (method) => requests.filter((r) => r.method === method).length

try {
  // ------------------------------------------------------------------
  section('1. Dashboard shows the trips stored in the database')
  await page.goto(`${BASE}/`)
  await page.waitForSelector(CARDS)
  check(`dashboard renders ${baseline} cards (DB has ${baseline})`, (await page.locator(CARDS).count()) === baseline)

  const statuses = await page.$$eval(CARDS, (links) =>
    links.map((a) => (a.textContent.includes('Completed') ? 'completed' : 'active')),
  )
  const firstCompleted = statuses.indexOf('completed')
  check(
    '"Soonest first" lists current and upcoming trips before completed ones',
    firstCompleted === -1 || !statuses.slice(firstCompleted).includes('active'),
    statuses.join(','),
  )
  check(
    'stats show the total number of trips',
    (await page.locator('section[aria-label="Trip summary"]').innerText()).includes(String(baseline)),
  )
  await shot(page, '01-dashboard', { fullPage: true })

  // ------------------------------------------------------------------
  section('2. Create form: client-side validation')
  await page.getByRole('link', { name: 'New trip' }).first().click()
  await page.waitForURL('**/trips/new')
  const postsBefore = countRequests('POST')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForSelector('text=Give your trip a title.')
  for (const message of [
    'Give your trip a title.',
    'Where are you going?',
    'Choose a start date.',
    'Choose an end date.',
    'Enter a budget.',
  ]) {
    check(`shows "${message}"`, await page.getByText(message).isVisible())
  }
  check('no POST is sent for an invalid form', countRequests('POST') === postsBefore)
  check(
    'first invalid field is focused',
    (await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid'))) === 'true',
  )
  check(
    'invalid field points at its error message (aria-describedby)',
    await page.evaluate(() => {
      const id = document.activeElement?.getAttribute('aria-describedby')
      return Boolean(id && document.getElementById(id))
    }),
  )
  await shot(page, '02-create-validation')

  await page.getByLabel('Trip title').fill('E2E Lisbon Test')
  await page.getByLabel('Destination').fill('Lisbon, Portugal')
  await page.getByLabel('Start date').fill('2027-03-10')
  await page.getByLabel('End date').fill('2027-03-05')
  await page.getByLabel('Budget').fill('-20')
  await page.getByLabel('Budget').blur()
  check('end date before start date is flagged', await page.getByText("End date can't be before the start date.").isVisible())
  check('non-positive budget is flagged', await page.getByText('Enter an amount like 1500 or 1500.50.').isVisible())
  await page.getByLabel('Start date').fill('2027-03-01')
  check(
    'moving the start date re-validates the end date and clears the error',
    await until(async () => !(await page.getByText("End date can't be before the start date.").isVisible())),
  )

  // ------------------------------------------------------------------
  section('3. Create trip -> API -> database')
  await page.getByLabel('Budget').fill('1850.5')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForURL(/\/trips\/[0-9a-f-]{36}$/)
  const tripId = page.url().split('/').pop()
  const created = JSON.parse(lastRequest('POST').body)
  check('POST body has typed values (budget is a number)', created.budget === 1850.5 && created.start_date === '2027-03-01', JSON.stringify(created))
  check(
    'redirected to the new trip',
    await until(() => page.getByRole('heading', { level: 1, name: 'E2E Lisbon Test' }).isVisible()),
  )
  check('success toast is shown', await page.getByText('“E2E Lisbon Test” was created.').isVisible())
  const row = psql(
    `select title||'|'||destination||'|'||start_date||'|'||end_date||'|'||budget from trips where id='${tripId}'`,
  )
  check('row exists in Postgres with the right values', row === 'E2E Lisbon Test|Lisbon, Portugal|2027-03-01|2027-03-05|1850.50', row)
  check(
    'details show the budget and length',
    (await page.getByText('$1,850.50').first().isVisible()) && (await page.getByText('5 days').first().isVisible()),
  )
  await shot(page, '03-details', { fullPage: true })

  // ------------------------------------------------------------------
  section('4. The new trip appears on the dashboard')
  await page.getByRole('link', { name: 'Back to trips' }).click()
  check(
    `dashboard now has ${baseline + 1} cards`,
    await until(async () => (await page.locator(CARDS).count()) === baseline + 1),
  )
  check('new trip card is present', await page.getByRole('heading', { level: 3, name: 'E2E Lisbon Test' }).isVisible())

  // ------------------------------------------------------------------
  section('5. Edit -> PATCH only the changed fields -> database')
  await page.getByRole('link', { name: /E2E Lisbon Test/ }).click()
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.waitForURL('**/edit')
  check(
    'edit form is pre-filled from the server',
    (await page.getByLabel('Trip title').inputValue()) === 'E2E Lisbon Test' &&
      (await page.getByLabel('Budget').inputValue()) === '1850.5',
  )
  await page.getByLabel('Trip title').fill('E2E Lisbon Test (edited)')
  await page.getByLabel('Budget').fill('2000')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForURL(`**/trips/${tripId}`)
  check(
    'PATCH contains only the dirty fields',
    JSON.stringify(JSON.parse(lastRequest('PATCH').body)) === JSON.stringify({ title: 'E2E Lisbon Test (edited)', budget: 2000 }),
    lastRequest('PATCH').body,
  )
  check(
    'details page shows the edit without a reload',
    await until(
      async () =>
        (await page.getByRole('heading', { level: 1, name: 'E2E Lisbon Test (edited)' }).isVisible()) &&
        (await page.getByText('$2,000').first().isVisible()),
    ),
  )
  const edited = psql(`select title||'|'||budget||'|'||destination from trips where id='${tripId}'`)
  check('Postgres row updated; untouched fields preserved', edited === 'E2E Lisbon Test (edited)|2000.00|Lisbon, Portugal', edited)

  await page.getByRole('link', { name: 'Edit' }).click()
  await page.waitForURL('**/edit')
  const patchesBefore = countRequests('PATCH')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForURL(`**/trips/${tripId}`)
  check('saving with no changes sends no request', countRequests('PATCH') === patchesBefore)
  check('...and says so', await page.getByText('No changes to save.').isVisible())

  // ------------------------------------------------------------------
  section('6. Server-side validation errors are mapped onto the form')
  await page.goto(`${BASE}/trips/new`)
  await page.getByLabel('Trip title').fill('E2E Server Reject')
  await page.getByLabel('Destination').fill('Nowhere')
  await page.getByLabel('Start date').fill('2027-01-01')
  await page.getByLabel('End date').fill('2027-01-05')
  await page.getByLabel('Budget').fill('100')
  await page.route('**/api/v1/trips', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: [
              { type: 'string_too_short', loc: ['body', 'title'], msg: 'String should have at least 1 character', ctx: { min_length: 1 } },
              { type: 'value_error', loc: ['body'], msg: 'Value error, end_date cannot be earlier than start_date' },
            ],
          }),
        })
      : route.continue(),
  )
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForSelector('text=This field cannot be empty.')
  check('field error from the server is shown inline', await page.getByText('This field cannot be empty.').isVisible())
  const endId = await page.getByLabel('End date').getAttribute('id')
  check(
    'model-level date error lands on the End date field',
    (await page.locator(`[id="${endId}-error"]`).innerText()).includes("End date can't be before the start date."),
  )
  check('entered values are kept', (await page.getByLabel('Destination').inputValue()) === 'Nowhere')
  await page.unroute('**/api/v1/trips')

  // ------------------------------------------------------------------
  section('7. Create fails: server error, then network down')
  await page.route('**/api/v1/trips', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 500, body: 'boom' }) : route.continue(),
  )
  await page.getByLabel('Trip title').fill('E2E Server Reject')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForSelector('[role=alert] >> text=ran into a problem')
  check('500 shows a friendly banner without raw server text', !(await page.locator('[role=alert]').allInnerTexts()).join().includes('boom'))
  check('banner reassures that entries are kept', await page.getByText('Your entries are still here').isVisible())
  await page.unroute('**/api/v1/trips')

  await page.route('**/api/v1/trips', (route) =>
    route.request().method() === 'POST' ? route.abort('connectionrefused') : route.continue(),
  )
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForSelector("text=Can't reach the Trip Service")
  check("network failure shows the \"can't reach\" banner", true)
  await shot(page, '04-create-network-error')
  await page.unroute('**/api/v1/trips')
  check('the failed attempts wrote nothing to the database', psql(`select count(*) from trips where title='E2E Server Reject'`) === '0')

  // ------------------------------------------------------------------
  section('8. Loading, list failure and retry on the dashboard')
  await page.route('**/api/v1/trips', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  await page.goto(`${BASE}/`)
  check('skeletons are shown while loading', await page.getByRole('status', { name: 'Loading trips' }).isVisible())
  await shot(page, '05-dashboard-loading')
  await page.waitForSelector(CARDS)
  await page.unroute('**/api/v1/trips')

  await page.route('**/api/v1/trips', (route) => route.abort('connectionrefused'))
  await page.goto(`${BASE}/`)
  await page.waitForSelector("text=We couldn't load your trips", { timeout: 15000 })
  check('error state is shown when the API is unreachable', await page.getByText("Can't reach the Trip Service").isVisible())
  await shot(page, '06-dashboard-error')
  await page.unroute('**/api/v1/trips')
  await page.getByRole('button', { name: 'Try again' }).click()
  check('"Try again" recovers once the API is back', await until(async () => (await page.locator(CARDS).count()) === baseline + 1))

  // ------------------------------------------------------------------
  section('9. Search, filter and sort (state lives in the URL)')
  const search = page.getByLabel('Search trips or destinations')
  await search.pressSequentially('lisbon', { delay: 0 })
  await new Promise((resolve) => setTimeout(resolve, 400))
  check('fast typing in search keeps every character', (await search.inputValue()) === 'lisbon', await search.inputValue())
  check('search narrows to the matching trip', await until(async () => (await page.locator(CARDS).count()) === 1))
  check('query is mirrored in the URL', page.url().includes('q=lisbon'))
  await search.fill('zzzz')
  check('no-results state is shown', await until(() => page.getByText('No trips match your filters').isVisible()))
  await page.getByRole('button', { name: 'Clear filters' }).click()
  check('clearing restores the full list', await until(async () => (await page.locator(CARDS).count()) === baseline + 1))

  const completedCount = Number(
    (await page.getByRole('button', { name: /^Completed/ }).innerText()).replace(/\D/g, ''),
  )
  await page.getByRole('button', { name: /^Completed/ }).click()
  check(
    `status filter shows exactly the ${completedCount} completed trip(s)`,
    await until(async () => (await page.locator(CARDS).count()) === completedCount),
  )
  const onlyCompleted = await page.$$eval(CARDS, (links) => links.every((a) => a.textContent.includes('Completed')))
  check('every visible card is completed', onlyCompleted)
  await page.goto(`${BASE}/`)

  // ------------------------------------------------------------------
  section('10. Delete -> confirm dialog -> API -> database')
  await page.getByRole('link', { name: /E2E Lisbon Test/ }).click()
  await page.waitForURL(`**/trips/${tripId}`)
  await page.getByRole('button', { name: 'Delete' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  check('confirmation dialog names the trip', (await dialog.innerText()).includes('E2E Lisbon Test (edited)'))
  check(
    'focus starts on Cancel, not on the destructive button',
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Cancel',
  )
  await shot(page, '07-delete-dialog')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  check('Escape closes the dialog without deleting', psql(`select count(*) from trips where id='${tripId}'`) === '1')
  await page.getByRole('button', { name: 'Delete' }).click()
  await dialog.waitFor()
  await page.getByRole('button', { name: 'Cancel' }).click()
  check('Cancel keeps the trip', psql(`select count(*) from trips where id='${tripId}'`) === '1')

  await page.getByRole('button', { name: 'Delete' }).click()
  await page.route(`**/api/v1/trips/${tripId}`, (route) =>
    route.request().method() === 'DELETE' ? route.fulfill({ status: 503 }) : route.continue(),
  )
  await page.getByRole('button', { name: 'Delete trip' }).click()
  await page.waitForSelector('dialog >> text=unavailable')
  check('a failed delete keeps the dialog open and explains why', await dialog.isVisible())
  await page.unroute(`**/api/v1/trips/${tripId}`)
  check('trip is still in the database after the failed delete', psql(`select count(*) from trips where id='${tripId}'`) === '1')

  await page.getByRole('button', { name: 'Delete trip' }).click()
  await page.waitForURL(`${BASE}/`)
  check('redirected to the dashboard after delete', true)
  check('delete toast is shown', await page.getByText('“E2E Lisbon Test (edited)” was deleted.').isVisible())
  check('row is gone from Postgres', psql(`select count(*) from trips where id='${tripId}'`) === '0')
  check(
    `dashboard is back to ${baseline} cards, with no flash of the deleted trip`,
    await until(async () => (await page.locator(CARDS).count()) === baseline),
  )

  // ------------------------------------------------------------------
  section('11. Missing or invalid trips and unknown routes')
  await page.goto(`${BASE}/trips/${tripId}`)
  await page.waitForSelector('text=Trip not found')
  check('a deleted trip id shows "Trip not found"', true)
  await page.goto(`${BASE}/trips/not-a-uuid`)
  await page.waitForSelector('text=Trip not found')
  check('a malformed id (422) shows "Trip not found"', true)
  await page.goto(`${BASE}/trips/${tripId}/edit`)
  await page.waitForSelector('text=Trip not found')
  check('editing a deleted trip shows "Trip not found"', true)
  await page.goto(`${BASE}/nope/nothing`)
  check('an unknown route shows the 404 page', await page.getByText("This page doesn't exist").isVisible())

  // ------------------------------------------------------------------
  section('12. Responsive layout and accessibility spot checks')
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })
  const mobile = await mobileContext.newPage()
  const noHorizontalScroll = () => mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  await mobile.goto(`${BASE}/`)
  await mobile.waitForSelector(CARDS)
  check('no horizontal scroll on the mobile dashboard', await noHorizontalScroll())
  await shot(mobile, '08-mobile-dashboard')
  await mobile.goto(`${BASE}/trips/new`)
  check('no horizontal scroll on the mobile form', await noHorizontalScroll())
  await shot(mobile, '09-mobile-form')
  await mobile.goto(`${BASE}/`)
  await mobile.locator(CARDS).nth(1).click()
  await mobile.waitForSelector('h1')
  check('no horizontal scroll on mobile details', await noHorizontalScroll())
  check('a new page starts scrolled to the top', await until(async () => (await mobile.evaluate(() => window.scrollY)) === 0))
  await shot(mobile, '10-mobile-details', { fullPage: true })
  await mobileContext.close()

  await page.goto(`${BASE}/`)
  await page.waitForSelector('h1')
  await page.keyboard.press('Tab')
  check(
    'first Tab stop is the "Skip to content" link',
    (await page.evaluate(() => document.activeElement?.textContent)) === 'Skip to content',
  )
  check('page has exactly one h1', (await page.locator('h1').count()) === 1)
  check('document title is set per page', (await page.title()) === 'Trips · TripMind', await page.title())

  const darkContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
  const dark = await darkContext.newPage()
  await dark.goto(`${BASE}/`)
  await dark.waitForSelector(CARDS)
  check('dark theme follows the OS setting', (await dark.evaluate(() => document.documentElement.dataset.theme)) === 'dark')
  await dark.getByRole('switch').click()
  await dark.reload()
  await dark.waitForSelector(CARDS)
  check('theme choice persists across reloads', (await dark.evaluate(() => document.documentElement.dataset.theme)) === 'light')
  await darkContext.close()

  section('13. Console')
  // Failed requests are provoked on purpose above; anything else is a real problem.
  const unexpected = consoleErrors.filter(
    (text) => !/Failed to load resource|ERR_CONNECTION|net::|the server responded with a status/.test(text),
  )
  check('no unexpected console errors or React warnings', unexpected.length === 0, JSON.stringify(unexpected))
} finally {
  // Remove anything a failed run might have left behind.
  psql(`delete from trips where title like 'E2E %'`)
  const after = Number(psql('select count(*) from trips'))
  console.log(`\nDB trips after cleanup: ${after} (before: ${baseline})`)
  await browser.close()
}

console.log(`\n${passed} checks passed, ${failures.length} failed`)
if (failures.length > 0) {
  console.log('FAILED:', failures)
  process.exit(1)
}
