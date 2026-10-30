/**
 * End-to-end test of the Customer Workspace: browser -> client -> Trip Service -> Postgres.
 *
 * Drives a real Chrome against the running Docker Compose stack as two throwaway owners ("e2e-crm-a" and
 * "e2e-crm-b", created through the public API if they don't exist). It covers the customer form, the guided
 * inquiry form, drag-and-drop and the keyboard "Move to" menu (including a refused move), follow-ups, the
 * conversion to a trip with its duplicate guard, and that the second owner can reach none of the first one's data.
 * Run from the client folder:  node e2e/customers.mjs
 *
 * Optional environment variables: BASE_URL (default http://localhost:5173), CHROME_PATH, SCREENSHOT_DIR.
 * Everything it creates is deleted again, even if a check fails.
 */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const BASE = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const SHOTS = process.env.SCREENSHOT_DIR
const PASSWORD = 'E2e-Passw0rd!'
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

async function api(method, route, { token, body } = {}) {
  const res = await fetch(`${BASE}/api/v1${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

async function owner(email) {
  await api('POST', '/auth/register', { body: { email, password: PASSWORD } }) // fine if it already exists
  const { status, body } = await api('POST', '/auth/login', { body: { email, password: PASSWORD } })
  assert.equal(status, 200, `could not sign in ${email}`)
  return body.access_token
}

const iso = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
/** Polls until `read` returns the wanted value: the board moves a card before the server has answered. */
async function eventually(read, wanted, what) {
  let last
  for (let i = 0; i < 40; i++) {
    last = await read()
    if (last === wanted) return
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(last, wanted, what)
}
let passed = 0
const step = async (name, fn) => {
  try {
    await fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`)
    throw error
  }
}

const A = await owner('e2e-crm-a@example.com')
const B = await owner('e2e-crm-b@example.com')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true })
const created = { customers: [], trips: [] }
const consoleErrors = []

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/status of (4\d\d|409)/.test(m.text()) && consoleErrors.push(m.text()))
  const shot = (name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) })

  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email').fill('e2e-crm-a@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))

  await step('the sidebar has a labelled Business section with Customers', async () => {
    const group = page.getByRole('group', { name: 'Business' })
    await group.getByRole('link', { name: /Customers/ }).click()
    await page.waitForURL(`${BASE}/customers`)
    await group.locator('a[aria-current="page"]').waitFor()
  })

  await step('a brand-new owner sees a useful empty state, not a blank page', async () => {
    await page.getByText('No customers yet').waitFor()
    await page.getByRole('link', { name: 'Inquiries' }).click()
    await page.getByText('Start with a customer').waitFor()
    await page.getByRole('link', { name: 'Follow-ups', exact: false }).first().click()
    await page.getByText('Nothing due today').waitFor()
  })

  await step('adding a customer validates, saves, and opens their drawer', async () => {
    await page.goto(`${BASE}/customers`)
    await page.getByRole('button', { name: 'Add your first customer' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add customer' })
    await dialog.getByRole('button', { name: 'Add customer' }).click()
    await dialog.getByText('Enter the customer’s name.').waitFor()
    await dialog.getByLabel('Full name').fill('E2E Amina Rahman')
    await dialog.getByRole('button', { name: 'Add customer' }).click()
    await dialog.getByText(/email address or a phone number/).waitFor()
    await dialog.getByLabel('Email', { exact: true }).fill('e2e.amina@example.com')
    await dialog.getByLabel('Phone', { exact: true }).fill('+92 300 1234567')
    await dialog.getByLabel('City', { exact: true }).fill('Lahore')
    await dialog.getByRole('button', { name: 'Add customer' }).click()
    await page.getByRole('dialog', { name: /E2E Amina Rahman/ }).waitFor()
    assert.match(page.url(), /[?&]customer=/)
    const list = await api('GET', '/customers?q=E2E', { token: A })
    assert.equal(list.body.total, 1)
    created.customers.push(list.body.items[0].id)
    shot('customer-drawer')
  })

  await step('the same email is refused on the email field', async () => {
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add customer' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add customer' })
    await dialog.getByLabel('Full name').fill('Someone Else')
    await dialog.getByLabel('Email', { exact: true }).fill('E2E.Amina@example.com')
    await dialog.getByRole('button', { name: 'Add customer' }).click()
    await dialog.getByText('You already have a customer with this email address').waitFor()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    assert.equal((await api('GET', '/customers?q=Someone', { token: A })).body.total, 0)
  })

  let inquiryId
  await step('the guided inquiry form saves from the first step and again from the last', async () => {
    await page.goto(`${BASE}/customers/inquiries`)
    await page.getByRole('button', { name: 'Log your first inquiry' }).click()
    const dialog = page.getByRole('dialog', { name: 'New inquiry' })
    await dialog.getByLabel('Customer', { exact: true }).selectOption({ label: 'E2E Amina Rahman' })
    await dialog.getByRole('button', { name: 'Add inquiry' }).click()
    await dialog.getByText('Enter a destination.').waitFor()
    await dialog.getByLabel('Destination', { exact: true }).fill('E2E Hunza Valley')
    await dialog.getByLabel('Preferred start').fill(iso(60))
    await dialog.getByLabel('Preferred end').fill(iso(68))
    await dialog.getByLabel('First follow-up').fill(iso(-1))
    await dialog.getByRole('button', { name: 'Next' }).click()
    await dialog.getByLabel('Number of travelers').fill('3')
    await dialog.getByLabel('Of them, children').fill('3')
    await dialog.getByRole('button', { name: 'Next' }).click()
    await dialog.getByText('At least one traveler must be an adult.').waitFor()
    await dialog.getByLabel('Of them, children').fill('1')
    await dialog.getByRole('button', { name: 'Next' }).click()
    await dialog.getByText('Guesthouse').click()
    await dialog.getByText('Nature').click()
    await dialog.getByRole('button', { name: 'Next' }).click()
    await dialog.getByLabel('From', { exact: true }).fill('3000')
    await dialog.getByLabel('Up to', { exact: true }).fill('5000')
    await dialog.getByRole('button', { name: 'Next' }).click()
    await dialog.getByLabel('Special requests').fill('Vegetarian meals')
    shot('inquiry-form')
    await dialog.getByRole('button', { name: 'Add inquiry' }).click()
    await page.getByRole('dialog', { name: 'E2E Hunza Valley' }).waitFor()
    const { body } = await api('GET', '/inquiries?q=E2E', { token: A })
    assert.equal(body.total, 1)
    const row = body.items[0]
    inquiryId = row.id
    assert.equal(row.stage, 'new')
    assert.deepEqual([row.travelers, row.brief.children, row.budget_min, row.budget_max], [3, 1, 3000, 5000])
    assert.deepEqual(row.brief.accommodation_types, ['guesthouse'])
    assert.equal(row.next_follow_up_on, iso(-1))
    // The drawer shows the brief that was just captured.
    await page.getByText('Vegetarian meals').waitFor()
    await page.keyboard.press('Escape')
  })

  await step('dragging a card to an allowed column moves it, and the move is saved', async () => {
    await page.goto(`${BASE}/customers/inquiries`)
    const card = page.getByRole('article', { name: /E2E Hunza Valley/ })
    await card.dragTo(page.getByRole('region', { name: 'Contacted' }))
    await page.getByRole('region', { name: 'Contacted' }).getByRole('article').waitFor()
    await eventually(async () => (await api('GET', `/inquiries/${inquiryId}`, { token: A })).body.stage, 'contacted', 'the drag was not saved')
    shot('board-after-drag')
  })

  await step('dragging to a column the pipeline forbids is refused, explained, and changes nothing', async () => {
    await page.getByRole('article', { name: /E2E Hunza Valley/ }).dragTo(page.getByRole('region', { name: 'Confirmed' }))
    await page.getByText(/can only move to .*not Confirmed/).waitFor()
    assert.equal((await api('GET', `/inquiries/${inquiryId}`, { token: A })).body.stage, 'contacted')
    await page.getByRole('region', { name: 'Contacted' }).getByRole('article').waitFor()
  })

  await step('the keyboard "Move to" menu offers only allowed stages and moves the card', async () => {
    await page.getByRole('button', { name: /Move the E2E Hunza Valley inquiry/ }).click()
    const items = await page.getByRole('menuitem').allTextContents()
    assert.deepEqual(items, ['New', 'Planning', 'Quoted', 'Closed / Lost'])
    await page.getByRole('menuitem', { name: 'Planning' }).click()
    await page.getByRole('region', { name: 'Planning' }).getByRole('article').waitFor()
    for (const stage of ['Quoted', 'Confirmed']) {
      await page.getByRole('button', { name: /Move the E2E Hunza Valley inquiry/ }).click()
      await page.getByRole('menuitem', { name: stage }).click()
      await page.getByRole('region', { name: stage }).getByRole('article').waitFor()
    }
    await eventually(async () => (await api('GET', `/inquiries/${inquiryId}`, { token: A })).body.stage, 'confirmed', 'the moves were not saved')
  })

  await step('follow-ups: schedule from the drawer, see it overdue, complete it', async () => {
    await page.getByRole('article', { name: /E2E Hunza Valley/ }).getByRole('button', { name: 'E2E Hunza Valley', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'E2E Hunza Valley' })
    await drawer.getByRole('tab', { name: /Follow-ups/ }).click()
    await drawer.getByText('Follow up on E2E Hunza Valley').waitFor()
    await drawer.getByText('1 day overdue').waitFor()
    await drawer.getByRole('button', { name: 'Add follow-up' }).click()
    const form = page.getByRole('dialog', { name: 'Schedule a follow-up' })
    await form.getByLabel('What needs doing').fill('E2E send itinerary')
    await form.getByLabel('Due', { exact: true }).fill(iso(0))
    await form.getByRole('button', { name: 'Schedule' }).click()
    await drawer.getByText('E2E send itinerary').waitFor()
    await drawer.getByText('Due today').waitFor()
    await drawer.getByRole('checkbox', { name: /Mark “Follow up on E2E Hunza Valley” done/ }).click()
    await drawer.getByRole('checkbox', { name: /Reopen “Follow up on E2E Hunza Valley”/ }).waitFor()
    await drawer.getByRole('tab', { name: /History/ }).click()
    await drawer.getByText(/Completed a follow-up/).waitFor()
    const open = await api('GET', `/follow-ups?view=open&inquiry_id=${inquiryId}`, { token: A })
    assert.deepEqual(open.body.items.map((f) => f.title), ['E2E send itinerary'])
  })

  await step('the Follow-ups tab shows the real records under Today', async () => {
    await page.keyboard.press('Escape')
    await page.goto(`${BASE}/customers/follow-ups`)
    await page.getByText('E2E send itinerary').waitFor()
    await page.getByRole('button', { name: /Overdue/ }).count().then((n) => assert.equal(n, 1))
    await page.getByRole('button', { name: 'Completed' }).click()
    await page.getByText('Follow up on E2E Hunza Valley').waitFor()
  })

  let tripId
  await step('converting needs the confirmation box, then creates a trip linked to the customer', async () => {
    await page.goto(`${BASE}/customers/inquiries?inquiry=${inquiryId}`)
    const drawer = page.getByRole('dialog', { name: 'E2E Hunza Valley' })
    await drawer.getByRole('button', { name: 'Create trip' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create a trip from this inquiry' })
    assert.equal(await dialog.getByLabel('Trip title', { exact: true }).inputValue(), 'E2E Amina Rahman – E2E Hunza Valley')
    assert.equal(await dialog.getByLabel('Starts', { exact: true }).inputValue(), iso(60))
    assert.equal(await dialog.getByLabel('Ends', { exact: true }).inputValue(), iso(68))
    assert.equal(await dialog.getByLabel('Budget', { exact: true }).inputValue(), '5000')
    await dialog.getByRole('button', { name: 'Create trip' }).click()
    await dialog.getByText('Tick the box to confirm.').waitFor()
    assert.equal((await api('GET', '/trips', { token: A })).body.filter((t) => t.title.startsWith('E2E')).length, 0)
    shot('convert-dialog')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'Create trip' }).click()
    await drawer.getByText(/Converted to a trip/).waitFor()
    const trips = (await api('GET', '/trips', { token: A })).body.filter((t) => t.title.startsWith('E2E'))
    assert.equal(trips.length, 1)
    tripId = trips[0].id
    created.trips.push(tripId)
    assert.equal(trips[0].customer_id, created.customers[0])
    assert.equal(trips[0].budget, 5000)
    shot('converted-drawer')
  })

  await step('a converted inquiry cannot be converted, moved or deleted again', async () => {
    const drawer = page.getByRole('dialog', { name: 'E2E Hunza Valley' })
    assert.equal(await drawer.getByRole('button', { name: 'Create trip' }).count(), 0)
    assert.equal(await drawer.getByRole('button', { name: 'Delete inquiry' }).isDisabled(), true)
    const again = await api('POST', `/inquiries/${inquiryId}/convert`, { token: A, body: { title: 'Dup', destination: 'X', start_date: iso(1), end_date: iso(2), budget: 10, confirm: true } })
    assert.equal(again.status, 409)
    assert.equal((await api('GET', '/trips', { token: A })).body.filter((t) => t.title.startsWith('E2E') || t.title === 'Dup').length, 1)
  })

  await step('the customer 360 shows the inquiry, the trip and its history', async () => {
    await page.goto(`${BASE}/customers?customer=${created.customers[0]}`)
    const drawer = page.getByRole('dialog', { name: /E2E Amina Rahman/ })
    await drawer.getByRole('tab', { name: /Inquiries/ }).click()
    await drawer.getByText('E2E Hunza Valley').waitFor()
    await drawer.getByRole('tab', { name: /Trips/ }).click()
    await drawer.getByRole('link', { name: /E2E Amina Rahman – E2E Hunza Valley/ }).waitFor()
    await drawer.getByRole('tab', { name: 'Activity' }).click()
    await drawer.getByText(/Created the trip/).waitFor()
    await drawer.getByLabel('Log a note').fill('Called: prefers an easier second day.')
    await drawer.getByRole('button', { name: 'Add to history' }).click()
    await drawer.getByText('Called: prefers an easier second day.').waitFor()
    shot('customer-360-activity')
    // Contact details are never copied into the history.
    const events = JSON.stringify((await api('GET', `/customers/${created.customers[0]}/events`, { token: A })).body)
    assert.ok(!events.includes('1234567') && !events.includes('e2e.amina'))
  })

  await step('another owner cannot see or reach any of it, in the API or the UI', async () => {
    const id = created.customers[0]
    assert.equal((await api('GET', '/customers', { token: B })).body.total, 0)
    assert.equal((await api('GET', '/inquiries', { token: B })).body.total, 0)
    assert.equal((await api('GET', `/customers/${id}`, { token: B })).status, 404)
    assert.equal((await api('GET', `/inquiries/${inquiryId}`, { token: B })).status, 404)
    assert.equal((await api('PATCH', `/customers/${id}`, { token: B, body: { name: 'Hacked' } })).status, 404)
    assert.equal((await api('DELETE', `/customers/${id}`, { token: B })).status, 404)
    assert.equal((await api('GET', `/trips/${tripId}`, { token: B })).status, 404)
    assert.equal((await api('GET', `/customers/${id}`)).status, 401)
    const other = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await other.goto(`${BASE}/login`)
    await other.getByLabel('Email').fill('e2e-crm-b@example.com')
    await other.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
    await other.getByRole('button', { name: /sign in|log in/i }).click()
    await other.waitForURL((u) => !u.pathname.startsWith('/login'))
    await other.goto(`${BASE}/customers?customer=${id}`)
    await other.getByRole('heading', { name: 'Customer not found' }).waitFor()
    assert.equal(await other.getByText('E2E Amina Rahman').count(), 0)
    await other.close()
    assert.equal((await api('GET', `/customers/${id}`, { token: A })).body.name, 'E2E Amina Rahman')
  })

  await step('on a phone the pipeline scrolls sideways and the drawer is a full-screen view', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/customers/inquiries`)
    await page.getByRole('region', { name: 'Confirmed' }).waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `page scrolls sideways by ${overflow}px`)
    shot('mobile-board')
    await page.getByRole('region', { name: 'Confirmed' }).getByRole('button', { name: 'E2E Hunza Valley', exact: true }).click()
    const box = await page.getByRole('dialog', { name: 'E2E Hunza Valley' }).boundingBox()
    assert.ok(box && box.width >= 389, 'drawer should fill the phone screen')
    shot('mobile-drawer')
  })

  await step('deleting the customer removes their records but keeps the trip', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}/customers?customer=${created.customers[0]}`)
    await page.getByRole('button', { name: 'Delete customer' }).click()
    await page.getByRole('dialog', { name: /Delete E2E Amina Rahman/ }).getByRole('button', { name: 'Delete customer' }).click()
    await page.getByText('No customers yet').waitFor()
    assert.equal((await api('GET', `/inquiries/${inquiryId}`, { token: A })).status, 404)
    const trip = await api('GET', `/trips/${tripId}`, { token: A })
    assert.equal(trip.status, 200)
    assert.equal(trip.body.customer_id, null)
    created.customers.length = 0
  })

  assert.deepEqual(consoleErrors, [], `browser errors: ${consoleErrors.join(' | ')}`)
  console.log(`\n${passed} checks passed`)
} finally {
  for (const id of created.customers) await api('DELETE', `/customers/${id}`, { token: A })
  for (const id of created.trips) await api('DELETE', `/trips/${id}`, { token: A })
  await browser.close()
}
