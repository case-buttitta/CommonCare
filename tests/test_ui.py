import pytest
import requests
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
import os

# Set to False to run tests with visible browser window
HEADLESS = True


class TestUserUI:
    """Test suite for UI verification of user operations."""

    @pytest.fixture(scope='function')
    def driver(self):
        """Set up Chrome WebDriver for testing."""
        chrome_options = Options()
        if HEADLESS:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        
        driver = webdriver.Chrome(options=chrome_options)
        driver.implicitly_wait(10)
        yield driver
        driver.quit()

    def test_user_appears_in_ui_after_creation(self, driver, ui_base_url, api_base_url):
        """Test that a newly created user appears in the UI table."""
        unique_username = f'ui_test_user_{int(time.time())}'
        unique_email = f'ui_test_{int(time.time())}@example.com'
        
        response = requests.post(
            f"{api_base_url}/api/users",
            json={
                'username': unique_username,
                'email': unique_email,
                'role': 'patient'
            }
        )
        assert response.status_code == 201
        user_id = response.json()['id']

        try:
            driver.get(ui_base_url)
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, 'users-table'))
            )

            time.sleep(1)
            driver.refresh()
            time.sleep(1)

            page_source = driver.page_source
            assert unique_username in page_source, f"Username {unique_username} not found in UI"
            assert unique_email in page_source, f"Email {unique_email} not found in UI"
        finally:
            requests.delete(f"{api_base_url}/api/users/{user_id}")

    def test_user_removed_from_ui_after_deletion(self, driver, ui_base_url, api_base_url):
        """Test that a deleted user is removed from the UI table."""
        unique_username = f'ui_delete_test_{int(time.time())}'
        unique_email = f'ui_delete_{int(time.time())}@example.com'

        response = requests.post(
            f"{api_base_url}/api/users",
            json={
                'username': unique_username,
                'email': unique_email,
                'role': 'staff'
            }
        )
        assert response.status_code == 201
        user_id = response.json()['id']

        driver.get(ui_base_url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'users-table'))
        )
        time.sleep(1)
        driver.refresh()
        time.sleep(1)

        assert unique_username in driver.page_source

        requests.delete(f"{api_base_url}/api/users/{user_id}")

        driver.refresh()
        time.sleep(1)

        assert unique_username not in driver.page_source

    def test_add_user_via_ui_form(self, driver, ui_base_url, api_base_url):
        """Test adding a user through the UI form."""
        unique_username = f'ui_form_test_{int(time.time())}'
        unique_email = f'ui_form_{int(time.time())}@example.com'

        driver.get(ui_base_url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'user-form'))
        )

        username_input = driver.find_element(By.CSS_SELECTOR, 'input[placeholder="Username"]')
        email_input = driver.find_element(By.CSS_SELECTOR, 'input[placeholder="Email"]')
        role_select = Select(driver.find_element(By.CSS_SELECTOR, '.user-form select'))
        submit_button = driver.find_element(By.CSS_SELECTOR, '.user-form button[type="submit"]')

        username_input.send_keys(unique_username)
        email_input.send_keys(unique_email)
        role_select.select_by_value('staff')
        submit_button.click()

        time.sleep(2)

        assert unique_username in driver.page_source
        assert unique_email in driver.page_source

        response = requests.get(f"{api_base_url}/api/users")
        users = response.json()
        created_user = next((u for u in users if u['username'] == unique_username), None)
        if created_user:
            requests.delete(f"{api_base_url}/api/users/{created_user['id']}")

    def test_delete_user_via_ui_button(self, driver, ui_base_url, api_base_url):
        """Test deleting a user through the UI delete button."""
        unique_username = f'ui_btn_delete_{int(time.time())}'
        unique_email = f'ui_btn_delete_{int(time.time())}@example.com'

        response = requests.post(
            f"{api_base_url}/api/users",
            json={
                'username': unique_username,
                'email': unique_email,
                'role': 'patient'
            }
        )
        assert response.status_code == 201

        driver.get(ui_base_url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'users-table'))
        )
        time.sleep(1)
        driver.refresh()
        time.sleep(1)

        rows = driver.find_elements(By.CSS_SELECTOR, '.users-table tbody tr')
        for row in rows:
            if unique_username in row.text:
                delete_btn = row.find_element(By.CLASS_NAME, 'delete-btn')
                delete_btn.click()
                break

        time.sleep(2)

        assert unique_username not in driver.page_source

    def test_role_dropdown_present_in_form(self, driver, ui_base_url):
        """Test that the role dropdown is present in the form."""
        driver.get(ui_base_url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'user-form'))
        )

        role_select = driver.find_element(By.CSS_SELECTOR, '.user-form select')
        assert role_select is not None

        select = Select(role_select)
        options = [opt.get_attribute('value') for opt in select.options]
        assert 'patient' in options
        assert 'staff' in options

    def test_role_badges_displayed(self, driver, ui_base_url, api_base_url):
        """Test that role badges are displayed correctly in the table."""
        driver.get(ui_base_url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'users-table'))
        )

        role_badges = driver.find_elements(By.CLASS_NAME, 'role-badge')
        assert len(role_badges) > 0

        for badge in role_badges:
            badge_classes = badge.get_attribute('class')
            assert 'patient' in badge_classes or 'staff' in badge_classes
