import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Helper to take screenshots
        async def snap(name, url):
            await page.goto(f"file://{os.getcwd()}/{url}")
            # Inject a test task to see the glass cards and tags
            await page.evaluate("""
                localStorage.setItem('studyflow_tasks', JSON.stringify([{
                    id: 'test-1',
                    title: 'Verify Glassmorphism',
                    subject: 'MATH',
                    priority: 'critical',
                    completed: false,
                    dueDate: new Date().toISOString().split('T')[0],
                    subtasks: []
                }]));
                localStorage.setItem('studyflow_subjects', JSON.stringify([{
                    id: 'sub-1',
                    name: 'MATH',
                    color: '#3B82F6'
                }]));
            """)
            await page.reload()
            await page.wait_for_timeout(1000)
            await page.screenshot(path=f"verification/{name}.png")

        os.makedirs("verification", exist_ok=True)

        # 1. Dashboard
        await snap("dashboard", "index.html")

        # 2. Tasks (filters, checkboxes, glass cards)
        await snap("tasks", "tasks.html")

        # 3. Calendar (Temporal Map)
        await snap("calendar", "calendar.html")

        # 4. Timer (Focus Sphere)
        await snap("timer", "timer.html")

        # 5. Goals (Mobile view to check collisions)
        mobile_context = await browser.new_context(**p.devices['iPhone 12'])
        mobile_page = await mobile_context.new_page()
        await mobile_page.goto(f"file://{os.getcwd()}/goals.html")
        await mobile_page.wait_for_timeout(1000)
        await mobile_page.screenshot(path="verification/goals_mobile.png")

        # 6. Analytics
        await page.goto(f"file://{os.getcwd()}/history.html")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="verification/analytics.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
