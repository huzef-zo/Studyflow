import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        await page.goto('http://localhost:8080/index.html')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='verification/screenshots/dashboard_final_v2.png')
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
