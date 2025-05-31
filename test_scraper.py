import unittest
from unittest.mock import patch, MagicMock, call, mock_open
import sqlite3
import sys
import os
from datetime import datetime

# Add the parent directory to sys.path to allow importing scraper
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Now import the classes from scrape.py
import scrape
import requests # For requests.exceptions
import smtplib  # For smtplib.SMTPException


class TestDatabase(unittest.TestCase):

    @patch('scrape.sqlite3.connect')
    def test_init_and_create_tables(self, mock_connect):
        """Test Database initialization and table creation."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database(db_path='test.db')

        mock_connect.assert_called_once_with('test.db')
        db.conn.cursor.assert_called_once()

        # SQL from scrape.py's _create_tables method
        expected_sql_from_source = """
            CREATE TABLE IF NOT EXISTS blog_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL UNIQUE,  # Title of the blog post, must be unique
                post TEXT NOT NULL,          # Full text content of the post
                post_date TEXT,              # Extracted publication date of the post (YYYY-MM-DD)
                scraped_date TEXT NOT NULL,  # Timestamp when the post was scraped
                sent INTEGER NOT NULL DEFAULT 0  # Flag (0 or 1) to indicate if notification has been sent
            )
        """
        # Normalize by stripping leading/trailing whitespace from the whole block
        # and from each line, then join with a single space.
        normalize_sql = lambda s: ' '.join(line.strip() for line in s.strip().splitlines())

        actual_sql_call = mock_cursor.execute.call_args[0][0]
        self.assertEqual(normalize_sql(actual_sql_call), normalize_sql(expected_sql_from_source), "CREATE TABLE SQL mismatch")
        db.conn.commit.assert_called_once()

    @patch('scrape.sqlite3.connect')
    def test_insert_post_success(self, mock_connect):
        """Test successful post insertion."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        mock_cursor.execute.reset_mock() # Reset after _create_tables call
        mock_conn.commit.reset_mock() # Reset commit mock after _create_tables' commit

        # Mock datetime.now to control scraped_date
        fixed_now = datetime(2024, 1, 1, 12, 0, 0)
        with patch('scrape.datetime') as mock_datetime:
            mock_datetime.now.return_value = fixed_now
            iso_fixed_now = fixed_now.isoformat()

            result = db.insert_post("Test Title", "Test Post Content", "2024-01-01")

            self.assertTrue(result)
            expected_sql = 'INSERT INTO blog_posts (title, post, post_date, scraped_date) VALUES (?, ?, ?, ?)'
            mock_cursor.execute.assert_called_once_with(expected_sql, ("Test Title", "Test Post Content", "2024-01-01", iso_fixed_now))
            mock_conn.commit.assert_called_once()

    @patch('scrape.sqlite3.connect')
    @patch('scrape.logger.warning') # Mock logger to check calls
    def test_insert_post_duplicate(self, mock_logger_warning, mock_connect):
        """Test post insertion failure due to IntegrityError (duplicate)."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database() # db instance created here
        # Configure the mock execute to raise IntegrityError for the specific insert call
        db.cursor.execute.side_effect = sqlite3.IntegrityError("UNIQUE constraint failed: blog_posts.title")
        mock_conn.commit.reset_mock() # Reset commit mock after __init__

        result = db.insert_post("Existing Title", "Some content")

        self.assertFalse(result)
        mock_conn.commit.assert_not_called() # Commit should not be called if insert fails
        mock_logger_warning.assert_called_once_with("Post already exists in DB: Existing Title")

    @patch('scrape.sqlite3.connect')
    @patch('scrape.logger.error') # Mock logger
    def test_insert_post_other_db_error(self, mock_logger_error, mock_connect):
        """Test post insertion failure due to a generic database error."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        # Configure the mock execute to raise a generic Exception for the specific insert call
        db.cursor.execute.side_effect = Exception("Some generic DB error")
        mock_conn.commit.reset_mock() # Reset commit mock after __init__

        result = db.insert_post("New Title", "Some content")

        self.assertFalse(result)
        mock_conn.commit.assert_not_called()
        mock_logger_error.assert_called_once_with("Database error while inserting post 'New Title': Some generic DB error")

    @patch('scrape.sqlite3.connect')
    def test_get_unsent_posts_success(self, mock_connect):
        """Test successfully fetching unsent posts."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        mock_cursor.execute.reset_mock() # Reset after _create_tables

        expected_posts = [(1, "Title1", "Content1", "2024-01-01"), (2, "Title2", "Content2", "2024-01-02")]
        mock_cursor.fetchall.return_value = expected_posts

        result = db.get_unsent_posts()

        self.assertEqual(result, expected_posts)
        mock_cursor.execute.assert_called_once_with('SELECT id, title, post, post_date FROM blog_posts WHERE sent = 0')
        mock_cursor.fetchall.assert_called_once()

    @patch('scrape.sqlite3.connect')
    @patch('scrape.logger.error')
    def test_get_unsent_posts_db_error(self, mock_logger_error, mock_connect):
        """Test fetching unsent posts when a database error occurs."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        # Set side_effect for the execute call within get_unsent_posts
        # This applies after _create_tables has already run with default mock behavior
        def execute_side_effect_for_select(sql_query, params=None):
            if "SELECT" in sql_query and "FROM blog_posts WHERE sent = 0" in sql_query:
                raise Exception("DB error on fetch")
            return MagicMock() # default for other calls, e.g. during __init__
        db.cursor.execute = MagicMock(side_effect=execute_side_effect_for_select)


        result = db.get_unsent_posts()
        self.assertEqual(result, [])
        mock_logger_error.assert_called_once_with("Error fetching unsent posts: DB error on fetch")


    @patch('scrape.sqlite3.connect')
    def test_mark_as_sent_success(self, mock_connect):
        """Test successfully marking a post as sent."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        mock_cursor.execute.reset_mock() # Reset after _create_tables call
        mock_conn.commit.reset_mock() # Reset commit mock
        db.mark_as_sent(123)

        mock_cursor.execute.assert_called_once_with('UPDATE blog_posts SET sent = 1 WHERE id = ?', (123,))
        mock_conn.commit.assert_called_once()

    @patch('scrape.sqlite3.connect')
    @patch('scrape.logger.error')
    def test_mark_as_sent_db_error(self, mock_logger_error, mock_connect):
        """Test marking a post as sent when a database error occurs."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        # Set side_effect for the execute call within mark_as_sent
        def execute_side_effect_for_update(sql_query, params=None):
            # This check ensures the create table in __init__ doesn't raise the error
            if "UPDATE blog_posts SET sent = 1" in sql_query:
                raise Exception("DB error on update")
            return MagicMock() # Default for other calls
        db.cursor.execute = MagicMock(side_effect=execute_side_effect_for_update)
        mock_conn.commit.reset_mock() # Reset commit mock after __init__

        db.mark_as_sent(123)

        mock_conn.commit.assert_not_called() # Should not commit if execute fails
        mock_logger_error.assert_called_once_with("Error marking post ID 123 as sent: DB error on update")

    @patch('scrape.sqlite3.connect')
    def test_get_all_posts_success(self, mock_connect):
        """Test successfully fetching all posts."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        mock_cursor.execute.reset_mock() # Reset after _create_tables

        expected_data = [
            (1, "Title1", "Post1", "2023-01-01", "2023-01-02T10:00:00", 0),
            (2, "Title2", "Post2", "2023-01-03", "2023-01-04T11:00:00", 1)
        ]
        mock_cursor.fetchall.return_value = expected_data

        result = db.get_all_posts()

        self.assertEqual(result, expected_data)
        mock_cursor.execute.assert_called_once_with('SELECT id, title, post, post_date, scraped_date, sent FROM blog_posts ORDER BY id')
        mock_cursor.fetchall.assert_called_once()

    @patch('scrape.sqlite3.connect')
    @patch('scrape.logger.error')
    def test_get_all_posts_db_error(self, mock_logger_error, mock_connect):
        """Test fetching all posts when a database error occurs."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        db = scrape.Database()
        def execute_side_effect_for_select_all(sql_query): # Renamed for clarity
            if "SELECT id, title, post, post_date, scraped_date, sent FROM blog_posts ORDER BY id" in sql_query:
                raise Exception("DB error on fetch all")
            return MagicMock()
        db.cursor.execute = MagicMock(side_effect=execute_side_effect_for_select_all)

        result = db.get_all_posts()

        self.assertEqual(result, [])
        mock_logger_error.assert_called_once_with("Error fetching all posts: DB error on fetch all")


class TestKvkkScraper(unittest.TestCase):
    def setUp(self):
        # Mock the Database instance for KvkkScraper
        self.mock_db = MagicMock(spec=scrape.Database) # Use spec for better mocking
        # Instance of KvkkScraper with mocked DB
        self.scraper = scrape.KvkkScraper(self.mock_db)
        self.sample_posts_data = [
            (1, "Title1", "Post1 text", "2023-01-01", "2023-01-02T10:00:00", 0),
            (2, "Title2", "Post2 text", "2023-01-03", "2023-01-04T11:00:00", 1)
        ]

    @patch('scrape.requests.get')
    @patch('scrape.time.sleep') # To avoid actual sleeping during tests
    @patch('scrape.logger') # To check log messages
    def test_make_request_success(self, mock_logger, mock_sleep, mock_requests_get):
        """Test _make_request successful on first try."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = "Success content"
        mock_requests_get.return_value = mock_response

        result = self.scraper._make_request("http://example.com")

        self.assertEqual(result, mock_response)
        mock_requests_get.assert_called_once_with("http://example.com", allow_redirects=False, headers=unittest.mock.ANY, timeout=30)
        mock_sleep.assert_not_called() # No retries, so no sleep

    @patch('scrape.requests.get')
    @patch('scrape.time.sleep')
    @patch('scrape.logger')
    def test_make_request_redirect(self, mock_logger, mock_sleep, mock_requests_get):
        """Test _make_request handles 302 redirect."""
        mock_response = MagicMock()
        mock_response.status_code = 302
        mock_requests_get.return_value = mock_response

        result = self.scraper._make_request("http://example.com/redirect")

        self.assertIsNone(result)
        mock_requests_get.assert_called_once_with("http://example.com/redirect", allow_redirects=False, headers=unittest.mock.ANY, timeout=30)
        mock_logger.info.assert_any_call("Redirect (302) encountered at http://example.com/redirect. Assuming end of content for this path.")
        mock_sleep.assert_not_called()

    @patch('scrape.requests.get')
    @patch('scrape.time.sleep')
    @patch('scrape.logger')
    def test_make_request_failed_after_retries(self, mock_logger, mock_sleep, mock_requests_get):
        """Test _make_request fails after all retries for non-200/302 status."""
        mock_response = MagicMock()
        mock_response.status_code = 404 # Example of a failing status
        mock_requests_get.return_value = mock_response

        # Access MAX_RETRIES from the scrape module where it's defined
        max_retries = scrape.MAX_RETRIES

        result = self.scraper._make_request("http://example.com/notfound")

        self.assertIsNone(result)
        self.assertEqual(mock_requests_get.call_count, max_retries)
        self.assertEqual(mock_sleep.call_count, max_retries - 1) # Sleeps between retries

        # Check log for failed request attempt (at least the last one)
        mock_logger.warning.assert_any_call(f"Request to http://example.com/notfound failed with status code 404 on attempt {max_retries}.")
        mock_logger.error.assert_any_call(f"Failed to fetch http://example.com/notfound after {max_retries} attempts.")

    @patch('scrape.requests.get')
    @patch('scrape.time.sleep')
    @patch('scrape.logger')
    def test_make_request_exception_and_retry(self, mock_logger, mock_sleep, mock_requests_get):
        """Test _make_request retries on requests.exceptions.RequestException and eventually fails."""
        # Simulate RequestException on first call, then a 500, then success (to test retry limit)
        mock_response_fail = MagicMock()
        mock_response_fail.status_code = 500 #

        # Access MAX_RETRIES from the scrape module
        max_retries = scrape.MAX_RETRIES

        # Make requests.get raise an exception for the first n-1 calls, then a failing status code
        side_effects = [requests.exceptions.RequestException("Connection error")] * (max_retries -1) + [mock_response_fail]
        mock_requests_get.side_effect = side_effects

        result = self.scraper._make_request("http://example.com/faulty")

        self.assertIsNone(result)
        self.assertEqual(mock_requests_get.call_count, max_retries)
        self.assertEqual(mock_sleep.call_count, max_retries - 1)

        # Check logging for the exception
        mock_logger.error.assert_any_call(f"Request error for http://example.com/faulty on attempt 1/{max_retries}: Connection error")
        # Check logging for the final status code failure
        mock_logger.warning.assert_any_call(f"Request to http://example.com/faulty failed with status code 500 on attempt {max_retries}.")
        mock_logger.error.assert_any_call(f"Failed to fetch http://example.com/faulty after {max_retries} attempts.")

    @patch('scrape.requests.get')
    @patch('scrape.time.sleep')
    @patch('scrape.logger')
    def test_make_request_success_on_retry(self, mock_logger, mock_sleep, mock_requests_get):
        """Test _make_request succeeds on a retry attempt."""
        mock_response_success = MagicMock()
        mock_response_success.status_code = 200
        mock_response_success.content = "Finally succeeded"

        mock_response_fail_status = MagicMock()
        mock_response_fail_status.status_code = 503 # Service unavailable

        # Fail first, then succeed
        mock_requests_get.side_effect = [
            requests.exceptions.Timeout("Timeout on first attempt"),
            mock_response_fail_status,
            mock_response_success
        ]

        result = self.scraper._make_request("http://example.com/retry-success")

        self.assertEqual(result, mock_response_success)
        self.assertEqual(mock_requests_get.call_count, 3) # Called 3 times (timeout, 503, 200)
        self.assertEqual(mock_sleep.call_count, 2) # Slept after timeout and after 503

        # Check specific log messages
        mock_logger.error.assert_any_call("Request timed out for http://example.com/retry-success on attempt 1/3.")
        mock_logger.warning.assert_any_call("Request to http://example.com/retry-success failed with status code 503 on attempt 2.")
        mock_logger.debug.assert_any_call("Successfully fetched http://example.com/retry-success with status 200.")

    def test_extract_date_various_formats(self):
        """Test extract_date with different valid date formats."""
        test_cases = {
            "Some text with 01/02/2023 date.": "2023-02-01",
            "Another with 31.12.2024 here.": "2024-12-31",
            "Date as 5.3.2022.": "2022-03-05", # Single digit day/month
            "Turkish date: 05 Ocak 2023 in text.": "2023-01-05",
            "Turkish date: 15 şubat 2024.": "2024-02-15", # Lowercase month
            "Text 22 Mart 2022 with caps month.": "2022-03-22", # Changed MART to Mart
            "A long text that includes the date 1 Nisan 2023 somewhere.": "2023-04-01",
            # Ensure it picks the first valid date if multiple are present, though current patterns are greedy.
            # This test assumes first match wins based on pattern order or first occurrence.
            "Multiple dates: 01.01.2020 then 02.02.2022.": "2020-01-01",
        }
        for text, expected_date in test_cases.items():
            with self.subTest(text=text):
                self.assertEqual(self.scraper.extract_date(text), expected_date)

    def test_extract_date_no_date(self):
        """Test extract_date with text containing no valid date."""
        self.assertIsNone(self.scraper.extract_date("This text has no date."))
        # Current extract_date does not do calendrical validation, so "32/13/2023" -> "2023-13-32"
        self.assertEqual(self.scraper.extract_date("Date like 32/13/2023 is invalid."), "2023-13-32")
        self.assertIsNone(self.scraper.extract_date("Almost a date 01/02 but no year."))
        self.assertIsNone(self.scraper.extract_date("2023-01-01 in YYYY-MM-DD is not matched by current patterns."))

    @patch.object(scrape.KvkkScraper, '_make_request') # Patching the method on the class
    def test_get_list_success(self, mock_make_request):
        """Test get_list successfully parses links from HTML."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        # Simplified HTML structure based on constants in scrape.py
        mock_response.content = f'''
            <html><body>
                <div class="{scrape.firstPostClassName}">
                    <a href="/link1_featured">Featured Post</a>
                </div>
                <div class="{scrape.listClassName}">
                    <a href="/link2_normal">Normal Post 1</a>
                </div>
                <div class="{scrape.listClassName}">
                    <a href="/link3_another">Normal Post 2</a>
                </div>
                <div class="{scrape.listClassName}">
                    <a href="/link1_featured">Duplicate Featured Post in list</a>
                </div>
            </body></html>
        '''.encode('utf-8')
        mock_make_request.return_value = mock_response

        expected_hrefs = ["/link1_featured", "/link2_normal", "/link3_another"] # Expecting unique links
        actual_hrefs = self.scraper.get_list("http://example.com/listpage")

        self.assertCountEqual(actual_hrefs, expected_hrefs) # Use assertCountEqual for list comparison regardless of order
        mock_make_request.assert_called_once_with("http://example.com/listpage")

    @patch.object(scrape.KvkkScraper, '_make_request')
    @patch('scrape.logger')
    def test_get_list_no_links_found(self, mock_logger, mock_make_request):
        """Test get_list when no links are found on the page."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = f'''
            <html><body>
                <p>No relevant links here.</p>
            </body></html>
        '''.encode('utf-8')
        mock_make_request.return_value = mock_response

        result = self.scraper.get_list("http://example.com/nolinks")
        self.assertFalse(result) # Expecting False as per current implementation
        mock_logger.info.assert_any_call(f"No post links found on page: http://example.com/nolinks. This might be the end of pagination.")

    @patch.object(scrape.KvkkScraper, '_make_request')
    @patch('scrape.logger')
    def test_get_list_request_fails(self, mock_logger, mock_make_request):
        """Test get_list when the initial request fails."""
        mock_make_request.return_value = None # Simulate _make_request failure

        result = self.scraper.get_list("http://example.com/requestfail")
        self.assertFalse(result)
        mock_logger.info.assert_any_call("Failed to get list from http://example.com/requestfail, no response or redirect assumed as end. Stopping for this path.")


    @patch.object(scrape.KvkkScraper, '_make_request')
    def test_get_blog_post_success(self, mock_make_request):
        """Test get_blog_post successfully parses title, content, and date."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = f'''
            <html><body>
                <div class="{scrape.postClassName}">
                    <h1 class="{scrape.postTitleClass}">  {scrape.stringToRemove}My Test Title  </h1>
                    <p>This is the main content.</p>
                    <p>Some more text here with a date 25.07.2023 for extraction.</p>
                </div>
            </body></html>
        '''.encode('utf-8')
        mock_make_request.return_value = mock_response

        title, post_text, post_date = self.scraper.get_blog_post("http://example.com/post1")

        self.assertEqual(title, "My Test Title")
        # The post_text includes the uncleaned title as it's part of the container's text
        expected_text = f"  {scrape.stringToRemove}My Test Title  \nThis is the main content.\nSome more text here with a date 25.07.2023 for extraction."
        self.assertEqual(post_text.strip(), expected_text.strip())
        self.assertEqual(post_date, "2023-07-25")
        mock_make_request.assert_called_once_with("http://example.com/post1")

    @patch.object(scrape.KvkkScraper, '_make_request')
    @patch('scrape.logger')
    def test_get_blog_post_content_missing(self, mock_logger, mock_make_request):
        """Test get_blog_post when essential content (post container) is missing."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = f'''
            <html><body>
                <p>No post container here.</p>
            </body></html>
        '''.encode('utf-8')
        mock_make_request.return_value = mock_response

        result = self.scraper.get_blog_post("http://example.com/missing_content")
        self.assertIsNone(result)
        mock_logger.error.assert_any_call(f"Post content container with class '{scrape.postClassName}' not found at http://example.com/missing_content. Cannot extract details.")

    @patch.object(scrape.KvkkScraper, '_make_request')
    @patch('scrape.logger')
    def test_get_blog_post_title_missing_fallback(self, mock_logger, mock_make_request):
        """Test get_blog_post when specific title class is missing but fallback (h1) exists."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = f'''
            <html><body>
                <div class="{scrape.postClassName}">
                    <h1>  {scrape.stringToRemove}Fallback Title  </h1>
                    <p>Some content. Date: 10.10.2023</p>
                </div>
            </body></html>
        '''.encode('utf-8')
        mock_make_request.return_value = mock_response

        title, _, post_date = self.scraper.get_blog_post("http://example.com/fallback_title")
        self.assertEqual(title, "Fallback Title")
        self.assertEqual(post_date, "2023-10-10")
        mock_logger.warning.assert_any_call(f"Post title element with class '{scrape.postTitleClass}' not found at http://example.com/fallback_title. Trying fallback (h1/h2).")

    @patch.object(scrape.KvkkScraper, '_make_request')
    @patch('scrape.logger')
    def test_get_blog_post_title_fully_missing(self, mock_logger, mock_make_request):
        """Test get_blog_post when no title (not even fallback) can be found."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = f'''
            <html><body>
                <div class="{scrape.postClassName}">
                    <p>Just some paragraph, no title here.</p>
                </div>
            </body></html>
        '''.encode('utf-8')
        mock_make_request.return_value = mock_response
        result = self.scraper.get_blog_post("http://example.com/no_title_at_all")
        self.assertIsNone(result)
        mock_logger.error.assert_any_call("Fallback failed: No h1 or h2 title found at http://example.com/no_title_at_all. Cannot extract title.")


    @patch.object(scrape.KvkkScraper, '_make_request')
    @patch('scrape.logger')
    def test_get_blog_post_request_fails(self, mock_logger, mock_make_request):
        """Test get_blog_post when the initial request fails."""
        mock_make_request.return_value = None # Simulate _make_request failure

        result = self.scraper.get_blog_post("http://example.com/post_request_fail")
        self.assertIsNone(result)
        mock_logger.warning.assert_any_call("Failed to get blog post from http://example.com/post_request_fail, no response received.")

    @patch.object(scrape.KvkkScraper, 'get_list')
    @patch.object(scrape.KvkkScraper, 'get_blog_post')
    @patch('scrape.time.sleep') # Mock sleep to speed up test
    def test_scrape_data_full_scrape(self, mock_sleep, mock_get_blog_post, mock_get_list):
        """Test scrape_data in full scrape mode (refresh=False)."""
        # Simulate two pages of posts
        mock_get_list.side_effect = [
            ["/href1", "/href2"], # Page 1
            ["/href3"],           # Page 2
            False                 # End of pages
        ]
        # Simulate blog post data
        mock_get_blog_post.side_effect = [
            ("Title1", "Content1", "2024-01-01"),
            ("Title2", "Content2", "2024-01-02"),
            ("Title3", "Content3", "2024-01-03"),
        ]
        self.mock_db.insert_post.return_value = True # Always successful insertion

        self.scraper.scrape_data(refresh=False)

        self.assertEqual(mock_get_list.call_count, 3) # Called for page 1, 2, and 3 (which returns False)
        self.assertEqual(mock_get_blog_post.call_count, 3)
        self.assertEqual(self.mock_db.insert_post.call_count, 3)

        # Check calls for insert_post
        self.mock_db.insert_post.assert_any_call("Title1", "Content1", "2024-01-01")
        self.mock_db.insert_post.assert_any_call("Title2", "Content2", "2024-01-02")
        self.mock_db.insert_post.assert_any_call("Title3", "Content3", "2024-01-03")
        self.assertEqual(mock_sleep.call_count, 3) # Called after each successful post processing

    @patch.object(scrape.KvkkScraper, 'get_list')
    @patch.object(scrape.KvkkScraper, 'get_blog_post')
    @patch('scrape.time.sleep')
    def test_scrape_data_refresh_mode_stops_on_existing(self, mock_sleep, mock_get_blog_post, mock_get_list):
        """Test scrape_data in refresh mode stops when an existing post is found."""
        mock_get_list.side_effect = [
            ["/href1", "/href2_existing", "/href3"], # Page 1
            ["/href4"],                            # Page 2 (should not be reached)
            False
        ]
        mock_get_blog_post.side_effect = [
            ("Title1", "Content1", "2024-01-01"),
            ("Title2_Existing", "Content2", "2024-01-02"),
            # No more calls to get_blog_post should happen
        ]
        # Simulate insert_post: success for first, fail (existing) for second
        self.mock_db.insert_post.side_effect = [True, False]

        self.scraper.scrape_data(refresh=True)

        self.assertEqual(mock_get_list.call_count, 1) # Only page 1 should be fully processed for list
        self.assertEqual(mock_get_blog_post.call_count, 2) # Title1, Title2_Existing
        self.assertEqual(self.mock_db.insert_post.call_count, 2)
        self.mock_db.insert_post.assert_any_call("Title1", "Content1", "2024-01-01")
        self.mock_db.insert_post.assert_any_call("Title2_Existing", "Content2", "2024-01-02")
        self.assertEqual(mock_sleep.call_count, 1) # Only after the first successful insert

    @patch.object(scrape.KvkkScraper, 'get_list')
    @patch('scrape.logger')
    def test_scrape_data_no_hrefs_on_first_page(self, mock_logger, mock_get_list):
        """Test scrape_data when the first page returns no hrefs."""
        mock_get_list.return_value = False # No links on the very first page

        self.scraper.scrape_data(refresh=False)

        mock_get_list.assert_called_once() # Called for page 1
        mock_logger.info.assert_any_call(f"No more posts found on {scrape.baseUrl}{scrape.listings}1 or end of listings reached. Stopping scrape.")
        self.mock_db.insert_post.assert_not_called() # No posts should be inserted

    @patch.object(scrape.KvkkScraper, 'get_list')
    @patch.object(scrape.KvkkScraper, 'get_blog_post')
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_scrape_data_get_blog_post_returns_none(self, mock_sleep, mock_logger, mock_get_blog_post, mock_get_list):
        """Test scrape_data continues if get_blog_post fails for one item."""
        mock_get_list.side_effect = [["/href1", "/href2_fails", "/href3"], False]
        mock_get_blog_post.side_effect = [
            ("Title1", "Content1", "2024-01-01"),
            None, # Simulate failure for href2_fails
            ("Title3", "Content3", "2024-01-03")
        ]
        self.mock_db.insert_post.return_value = True

        self.scraper.scrape_data(refresh=False)

        self.assertEqual(mock_get_blog_post.call_count, 3)
        self.assertEqual(self.mock_db.insert_post.call_count, 2) # Only two successful inserts
        mock_logger.warning.assert_any_call(f"Failed to extract data from {scrape.baseUrl}/href2_fails, skipping.")

    @patch('scrape.smtplib.SMTP') # Mock the SMTP class
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_send_email_notifications_success(self, mock_sleep, mock_logger, mock_smtp_class):
        """Test send_email_notifications successfully sends emails for unsent posts."""
        unsent_posts_data = [
            (1, "Breach 1", "Content for breach 1...", "2024-01-01"),
            (2, "Breach 2", "Content for breach 2...", "2024-01-02"),
        ]
        self.mock_db.get_unsent_posts.return_value = unsent_posts_data

        mock_smtp_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server

        # Temporarily clear KEYWORD_WATCHLIST for this test to check baseline
        original_watchlist = scrape.KEYWORD_WATCHLIST
        scrape.KEYWORD_WATCHLIST = []

        self.scraper.send_email_notifications()

        scrape.KEYWORD_WATCHLIST = original_watchlist # Restore

        self.mock_db.get_unsent_posts.assert_called_once()
        self.assertEqual(mock_smtp_server.sendmail.call_count, 2)
        self.assertEqual(self.mock_db.mark_as_sent.call_count, 2)
        self.mock_db.mark_as_sent.assert_any_call(1)
        self.mock_db.mark_as_sent.assert_any_call(2)

        # Email 1 assertions
        args_email1, _ = mock_smtp_server.sendmail.call_args_list[0]
        msg_str_email1 = args_email1[2]
        self.assertIn("Subject: New KVKK Data Breach Notification: Breach 1", msg_str_email1)
        self.assertNotIn("[KEYWORD MATCH]", msg_str_email1) # Ensure no keyword tag

        body_part_email1 = msg_str_email1.split("\n\n", 1)[1] if "\n\n" in msg_str_email1 else ""
        decoded_body1 = body_part_email1
        if "Content-Transfer-Encoding: base64" in msg_str_email1:
            import base64
            decoded_body1 = base64.b64decode(body_part_email1).decode('utf-8')

        self.assertIn("Title: Breach 1", decoded_body1)
        self.assertIn("Publication Date: 2024-01-01", decoded_body1)
        self.assertIn("Content for breach 1...", decoded_body1)
        self.assertNotIn("Matched Keywords:", decoded_body1)
        mock_logger.info.assert_any_call("Successfully sent email for post ID 1: Breach 1")

        # Email 2 assertions
        args_email2, _ = mock_smtp_server.sendmail.call_args_list[1]
        msg_str_email2 = args_email2[2]
        self.assertIn("Subject: New KVKK Data Breach Notification: Breach 2", msg_str_email2)
        self.assertNotIn("[KEYWORD MATCH]", msg_str_email2)
        body_part_email2 = msg_str_email2.split("\n\n", 1)[1] if "\n\n" in msg_str_email2 else ""
        decoded_body2 = body_part_email2
        if "Content-Transfer-Encoding: base64" in msg_str_email2:
            import base64
            decoded_body2 = base64.b64decode(body_part_email2).decode('utf-8')
        self.assertIn("Title: Breach 2", decoded_body2)
        mock_logger.info.assert_any_call("Successfully sent email for post ID 2: Breach 2")


    @patch('scrape.logger')
    def test_send_email_notifications_no_unsent_posts(self, mock_logger):
        """Test send_email_notifications when there are no unsent posts."""
        self.mock_db.get_unsent_posts.return_value = []

        self.scraper.send_email_notifications()

        self.mock_db.get_unsent_posts.assert_called_once()
        mock_logger.info.assert_any_call("No new posts to send notifications for.")
        self.mock_db.mark_as_sent.assert_not_called()

    @patch('scrape.smtplib.SMTP')
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_send_email_notifications_smtp_error(self, mock_sleep, mock_logger, mock_smtp_class):
        """Test send_email_notifications handles SMTPException during sending."""
        unsent_posts_data = [(1, "Breach 1", "Content...", "2024-01-01")]
        self.mock_db.get_unsent_posts.return_value = unsent_posts_data

        mock_smtp_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server
        mock_smtp_server.sendmail.side_effect = smtplib.SMTPException("Test SMTP error")

        self.scraper.send_email_notifications()

        self.mock_db.get_unsent_posts.assert_called_once()
        mock_smtp_server.sendmail.assert_called_once() # Attempted to send one email
        self.mock_db.mark_as_sent.assert_not_called() # Should not be marked as sent
        mock_logger.error.assert_any_call("SMTP Error sending email for post ID 1 ('Breach 1'): Test SMTP error")

    @patch('scrape.smtplib.SMTP')
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_send_email_notifications_starttls_and_login(self, mock_sleep, mock_logger, mock_smtp_class):
        """Test email sending logic with STARTTLS and SMTP login."""
        # Store original SMTP_PORT and modify for this test
        original_smtp_port = scrape.SMTP_PORT
        scrape.SMTP_PORT = 587
        scrape.SMTP_USERNAME = "testuser" # Ensure username is set for login path
        scrape.SMTP_PASSWORD = "testpass" # Ensure password is set

        unsent_posts_data = [(1, "TLS Test Breach", "Content...", "2024-03-01")]
        self.mock_db.get_unsent_posts.return_value = unsent_posts_data

        mock_smtp_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server

        self.scraper.send_email_notifications()

        mock_smtp_server.starttls.assert_called_once()
        mock_smtp_server.login.assert_called_once_with("testuser", "testpass")
        self.assertEqual(mock_smtp_server.sendmail.call_count, 1)
        self.mock_db.mark_as_sent.assert_called_once_with(1)

        # Restore original values
        scrape.SMTP_PORT = original_smtp_port
        scrape.SMTP_USERNAME = "your_email@example.com"
        scrape.SMTP_PASSWORD = "your_email_password"

    @patch('scrape.smtplib.SMTP')
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_send_email_keyword_match_title(self, mock_sleep, mock_logger, mock_smtp_class):
        """Test email subject and body are modified when a keyword matches in the title."""
        unsent_posts_data = [(1, "Big Bank Data Breach", "Details about the bank breach...", "2024-03-15")]
        self.mock_db.get_unsent_posts.return_value = unsent_posts_data

        mock_smtp_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server

        original_watchlist = scrape.KEYWORD_WATCHLIST
        scrape.KEYWORD_WATCHLIST = ["bank", "finance"] # Test with "bank"

        self.scraper.send_email_notifications()

        scrape.KEYWORD_WATCHLIST = original_watchlist # Restore

        self.assertEqual(mock_smtp_server.sendmail.call_count, 1)
        args_email, _ = mock_smtp_server.sendmail.call_args_list[0]
        msg_str_email = args_email[2]

        self.assertIn("Subject: [KEYWORD MATCH] New KVKK Data Breach Notification: Big Bank Data Breach", msg_str_email)

        body_part = msg_str_email.split("\n\n", 1)[1] if "\n\n" in msg_str_email else ""
        decoded_body = body_part
        if "Content-Transfer-Encoding: base64" in msg_str_email:
            import base64
            decoded_body = base64.b64decode(body_part).decode('utf-8')

        self.assertIn("Matched Keywords: bank", decoded_body)
        self.assertIn("Title: Big Bank Data Breach", decoded_body)
        mock_logger.info.assert_any_call("Keyword match found for post ID 1 (Big Bank Data Breach): bank")
        self.mock_db.mark_as_sent.assert_called_once_with(1)

    @patch('scrape.smtplib.SMTP')
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_send_email_keyword_match_content(self, mock_sleep, mock_logger, mock_smtp_class):
        """Test email subject and body are modified when a keyword matches in the content."""
        unsent_posts_data = [(1, "Generic Title", "This post is about an e-ticaret platform security issue.", "2024-03-16")]
        self.mock_db.get_unsent_posts.return_value = unsent_posts_data

        mock_smtp_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server

        original_watchlist = scrape.KEYWORD_WATCHLIST
        scrape.KEYWORD_WATCHLIST = ["e-ticaret", "sağlık"]

        self.scraper.send_email_notifications()

        scrape.KEYWORD_WATCHLIST = original_watchlist

        self.assertEqual(mock_smtp_server.sendmail.call_count, 1)
        args_email, _ = mock_smtp_server.sendmail.call_args_list[0]
        msg_str_email = args_email[2]

        self.assertIn("Subject: [KEYWORD MATCH] New KVKK Data Breach Notification: Generic Title", msg_str_email)
        body_part = msg_str_email.split("\n\n", 1)[1] if "\n\n" in msg_str_email else ""
        decoded_body = body_part
        if "Content-Transfer-Encoding: base64" in msg_str_email:
            import base64
            decoded_body = base64.b64decode(body_part).decode('utf-8')

        self.assertIn("Matched Keywords: e-ticaret", decoded_body)
        self.assertIn("This post is about an e-ticaret platform security issue.", decoded_body)
        mock_logger.info.assert_any_call("Keyword match found for post ID 1 (Generic Title): e-ticaret")

    @patch('scrape.smtplib.SMTP')
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_send_email_no_keyword_match(self, mock_sleep, mock_logger, mock_smtp_class):
        """Test email subject and body are normal when no keyword matches."""
        unsent_posts_data = [(1, "Some Other News", "This is a regular update.", "2024-03-17")]
        self.mock_db.get_unsent_posts.return_value = unsent_posts_data

        mock_smtp_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server

        original_watchlist = scrape.KEYWORD_WATCHLIST
        scrape.KEYWORD_WATCHLIST = ["rarekeyword", "anotherone"] # Keywords not in post

        self.scraper.send_email_notifications()

        scrape.KEYWORD_WATCHLIST = original_watchlist

        args_email, _ = mock_smtp_server.sendmail.call_args_list[0]
        msg_str_email = args_email[2]

        self.assertIn("Subject: New KVKK Data Breach Notification: Some Other News", msg_str_email)
        self.assertNotIn("[KEYWORD MATCH]", msg_str_email)
        body_part = msg_str_email.split("\n\n", 1)[1] if "\n\n" in msg_str_email else ""
        decoded_body = body_part
        if "Content-Transfer-Encoding: base64" in msg_str_email:
            import base64
            decoded_body = base64.b64decode(body_part).decode('utf-8')
        self.assertNotIn("Matched Keywords:", decoded_body)

    @patch('scrape.smtplib.SMTP')
    @patch('scrape.logger')
    @patch('scrape.time.sleep')
    def test_send_email_empty_keyword_list(self, mock_sleep, mock_logger, mock_smtp_class):
        """Test email subject and body are normal when KEYWORD_WATCHLIST is empty."""
        unsent_posts_data = [(1, "Important Update", "Content with bank and hastane.", "2024-03-18")]
        self.mock_db.get_unsent_posts.return_value = unsent_posts_data

        mock_smtp_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_smtp_server

        original_watchlist = scrape.KEYWORD_WATCHLIST
        scrape.KEYWORD_WATCHLIST = [] # Empty watchlist

        self.scraper.send_email_notifications()

        scrape.KEYWORD_WATCHLIST = original_watchlist

        args_email, _ = mock_smtp_server.sendmail.call_args_list[0]
        msg_str_email = args_email[2]
        self.assertIn("Subject: New KVKK Data Breach Notification: Important Update", msg_str_email)
        self.assertNotIn("[KEYWORD MATCH]", msg_str_email)
        body_part = msg_str_email.split("\n\n", 1)[1] if "\n\n" in msg_str_email else ""
        decoded_body = body_part
        if "Content-Transfer-Encoding: base64" in msg_str_email:
            import base64
            decoded_body = base64.b64decode(body_part).decode('utf-8')
        self.assertNotIn("Matched Keywords:", decoded_body)


if __name__ == '__main__':
    unittest.main()
