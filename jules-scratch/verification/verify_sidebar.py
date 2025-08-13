from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Listen for all console events and print them
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.type}: {msg.text}"))

    try:
        page.goto("http://localhost:8000")

        # Wait for the main app to be visible
        expect(page.locator("#app")).to_be_visible(timeout=10000)

        # Click the button to open the sidebar
        open_sidebar_button = page.locator('button[aria-label="فتح الشريط الجانبي"]')
        expect(open_sidebar_button).to_be_visible()
        open_sidebar_button.click()

        # Wait for the sidebar component to be visible
        sidebar = page.locator("chat-history")
        expect(sidebar).to_be_visible()

        # A specific check to ensure the component is rendering content
        expect(sidebar.get_by_role("heading", name="المحادثات")).to_be_visible()

        page.wait_for_timeout(500)

        page.screenshot(path="jules-scratch/verification/sidebar_verification.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/sidebar_verification_error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
