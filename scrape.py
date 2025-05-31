import requests
from bs4 import BeautifulSoup
import sqlite3
import time 
import random
import logging
import re
from datetime import datetime
import smtplib
from email.mime.text import MIMEText

#
# EMAIL CONFIGURATION (PLACEHOLDERS - Move to secure config/env variables)
#
# These settings are placeholders. For a production environment,
# use environment variables, a configuration file, or a secure vault.

# TODO: Move KEYWORD_WATCHLIST to a configuration file or a separate manageable list.
KEYWORD_WATCHLIST = ["banka", "hastane", "e-ticaret", "sağlık"] # Example keywords

SMTP_SERVER = "smtp.example.com"  # e.g., 'smtp.gmail.com'
SMTP_PORT = 587  # Or 465 for SSL
SMTP_USERNAME = "your_email@example.com"
SMTP_PASSWORD = "your_email_password"
SENDER_EMAIL = "your_email@example.com"
RECIPIENT_EMAILS = ["recipient1@example.com", "recipient2@example.com"] # List of recipient email addresses

#
# LOGGING CONFIG
#
# Configure basic logging for the application.
# Logs will be written to "scraper.log" and also output to the console.
# Log format includes timestamp, log level, and the message.
logging.basicConfig(
    level=logging.INFO,  # Set the minimum logging level to INFO
    format='%(asctime)s - %(levelname)s - %(message)s',  # Define the log message format
    handlers=[
        logging.FileHandler("scraper.log"),  # Log messages to a file
        logging.StreamHandler()  # Log messages to the standard output stream (console)
    ]
)
logger = logging.getLogger(__name__) # Get a logger instance for the current module

#
# USER AGENTS
#
# A list of User-Agent strings to rotate through for making HTTP requests.
# This helps in mimicking different browsers and reducing the chance of being blocked.
user_agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15'
]

#
# DATABASE CONFIG
#
class Database:
    """
    Handles all database operations for the scraper.

    This class provides methods to connect to an SQLite database,
    create necessary tables, insert new data, retrieve unsent posts,
    and mark posts as sent.
    """
    def __init__(self, db_path='database.db'):
        """
        Initializes the Database object and connects to the SQLite database.

        Args:
            db_path (str, optional): The path to the SQLite database file.
                                     Defaults to 'database.db'.
        """
        self.conn = sqlite3.connect(db_path) # Establish connection to the SQLite database
        self.cursor = self.conn.cursor() # Create a cursor object to execute SQL queries
        self._create_tables() # Ensure the required tables are created
    
    def _create_tables(self):
        """
        Creates the 'blog_posts' table if it doesn't already exist.

        The table stores information about scraped blog posts, including
        title, content, publication date, scrape date, and sent status.
        """
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS blog_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL UNIQUE,  # Title of the blog post, must be unique
                post TEXT NOT NULL,          # Full text content of the post
                post_date TEXT,              # Extracted publication date of the post (YYYY-MM-DD)
                scraped_date TEXT NOT NULL,  # Timestamp when the post was scraped
                sent INTEGER NOT NULL DEFAULT 0  # Flag (0 or 1) to indicate if notification has been sent
            )
        ''')
        self.conn.commit() # Commit the changes to the database
    
    def insert_post(self, title, post, post_date=None):
        """
        Inserts a new blog post into the database.

        Args:
            title (str): The title of the blog post.
            post (str): The full text content of the blog post.
            post_date (str, optional): The publication date of the post (YYYY-MM-DD).
                                       Defaults to None.

        Returns:
            bool: True if the post was inserted successfully, False otherwise
                  (e.g., if the post already exists or a database error occurs).
        """
        try:
            scraped_date = datetime.now().isoformat() # Get current time as ISO format string
            self.cursor.execute(
                'INSERT INTO blog_posts (title, post, post_date, scraped_date) VALUES (?, ?, ?, ?)', 
                (title, post, post_date, scraped_date)
            )
            self.conn.commit()
            logger.info(f"Inserted post: {title}")
            return True
        except sqlite3.IntegrityError: # Specific error for UNIQUE constraint violation
            logger.warning(f"Post already exists in DB: {title}")
            return False
        except Exception as e:
            logger.error(f"Database error while inserting post '{title}': {e}")
            return False
    
    def get_unsent_posts(self):
        """
        Retrieves all posts from the database that have not yet been marked as sent.

        Returns:
            list: A list of tuples, where each tuple represents a post
                  (id, title, post, post_date). Returns an empty list if no
                  unsent posts are found or if an error occurs.
        """
        try:
            self.cursor.execute('SELECT id, title, post, post_date FROM blog_posts WHERE sent = 0')
            return self.cursor.fetchall()
        except Exception as e:
            logger.error(f"Error fetching unsent posts: {e}")
            return []
    
    def mark_as_sent(self, post_id):
        """
        Marks a specific post as sent in the database.

        Args:
            post_id (int): The ID of the post to mark as sent.
        """
        try:
            self.cursor.execute('UPDATE blog_posts SET sent = 1 WHERE id = ?', (post_id,))
            self.conn.commit()
            logger.info(f"Marked post ID {post_id} as sent.")
        except Exception as e:
            logger.error(f"Error marking post ID {post_id} as sent: {e}")
    
    def close(self):
        """Closes the database connection."""
        if self.conn: # Check if connection exists before trying to close
            self.conn.close()
            logger.info("Database connection closed.")

    def get_all_posts(self):
        """
        Retrieves all posts from the database.

        Returns:
            list: A list of tuples, where each tuple represents a post
                  (id, title, post, post_date, scraped_date, sent).
                  Returns an empty list if no posts are found or if an error occurs.
        """
        try:
            self.cursor.execute('SELECT id, title, post, post_date, scraped_date, sent FROM blog_posts ORDER BY id')
            return self.cursor.fetchall()
        except Exception as e:
            logger.error(f"Error fetching all posts: {e}")
            return []

#
# CONSTANT VARIABLES
#
# Base URL for the KVKK website.
baseUrl = "https://www.kvkk.gov.tr"
# Path for the data breach notification listings, with a placeholder for the page number.
listings = "/veri-ihlali-bildirimi/?&page="
# CSS class name used to identify the title elements in the blog grid/listings.
listClassName = "blog-grid-title"
# CSS class name for the container of the first (often a featured or main) post on a listing page.
firstPostClassName = "blog-post-container"
# CSS class name for the inner container of a single blog post's content.
postClassName = "blog-post-inner"
# CSS class name for the title of a single blog post.
postTitleClass = "blog-post-title"
# Strings to remove from the extracted title to clean it up.
# Consider making these regex for more flexibility if titles have more variations.
stringToRemove = "Kamuoyu Duyurusu (Veri İhlali Bildirimi) – "
stringToRemove2 = "Kamuoyu Duyurusu (Veri İhlali Bildirimi) - "
# Maximum number of retries for HTTP requests.
MAX_RETRIES = 3
# Initial delay in seconds before retrying a failed HTTP request. This delay will be subject to exponential backoff.
RETRY_DELAY = 5  # seconds

class KvkkScraper:
    """
    Scrapes data breach notifications from the KVKK website.

    This class includes methods to make HTTP requests with retries,
    extract data (URLs, titles, content, dates) from HTML using BeautifulSoup,
    and orchestrate the scraping process page by page, storing results via a Database object.
    """
    def __init__(self, db):
        """
        Initializes the KvkkScraper with a Database instance.

        Args:
            db (Database): An instance of the Database class for storing scraped data.
        """
        self.db = db # Store the passed database object for use in other methods
    
    def _get_random_headers(self):
        """
        Returns a dictionary containing a randomly selected User-Agent string.
        This helps in making requests appear as if they are coming from different browsers.

        Returns:
            dict: HTTP headers with a random User-Agent.
        """
        return {'User-Agent': random.choice(user_agents)}
    
    def _make_request(self, url, max_retries=MAX_RETRIES):
        """
        Makes an HTTP GET request to the given URL with a retry mechanism.

        Handles transient errors (like timeouts or temporary network issues) by
        retrying the request with exponential backoff. Rotates User-Agent for each request
        to reduce likelihood of being blocked.

        Args:
            url (str): The URL to fetch.
            max_retries (int, optional): Maximum number of retry attempts.
                                         Defaults to the class constant MAX_RETRIES.

        Returns:
            requests.Response or None: The response object if the request is successful (status 200).
                                       Returns None if a redirect (status 302, often meaning end of pages)
                                       is encountered, or if the request fails after all retries.
        """
        for attempt in range(max_retries):
            try:
                headers = self._get_random_headers() # Get random headers for this attempt
                # Make the GET request. `allow_redirects=False` lets us see 302s. `timeout` prevents hanging indefinitely.
                response = requests.get(url, allow_redirects=False, headers=headers, timeout=30)

                if response.status_code == 200:
                    logger.debug(f"Successfully fetched {url} with status 200.")
                    return response # Successful request
                elif response.status_code == 302:
                    # 302 Redirect often indicates the end of pagination (e.g., requesting page 100 when only 10 exist)
                    logger.info(f"Redirect (302) encountered at {url}. Assuming end of content for this path.")
                    return None # Signal that there's likely no more content here
                else:
                    # Log other non-200/302 status codes as warnings, as they might be unexpected
                    logger.warning(f"Request to {url} failed with status code {response.status_code} on attempt {attempt + 1}.")
            except requests.exceptions.Timeout: # Specifically catch timeout errors
                logger.error(f"Request timed out for {url} on attempt {attempt + 1}/{max_retries}.")
            except requests.exceptions.RequestException as e: # Catch other request-related exceptions (DNS failure, connection error, etc.)
                logger.error(f"Request error for {url} on attempt {attempt + 1}/{max_retries}: {e}")
            
            # Exponential backoff with jitter: RETRY_DELAY * (2^attempt) + random fraction of a second
            # This prevents retrying too aggressively and spreads out requests if multiple scrapers are running.
            if attempt < max_retries - 1: # Only sleep if there are more retries left
                sleep_time = RETRY_DELAY * (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"Retrying {url} in {sleep_time:.2f} seconds...")
                time.sleep(sleep_time)
        
        logger.error(f"Failed to fetch {url} after {max_retries} attempts.")
        return None # Return None if all retries fail
    
    def extract_date(self, post_text):
        """
        Extracts a date from the given post content using regular expressions.

        Tries multiple common date patterns found in KVKK posts, including
        DD/MM/YYYY, DD.MM.YYYY, and Turkish month names (e.g., "01 Ocak 2023").
        The extracted date is normalized and returned in 'YYYY-MM-DD' format.

        Args:
            post_text (str): The text content of a blog post from which to extract the date.

        Returns:
            str or None: The extracted date in 'YYYY-MM-DD' format if a recognized
                         pattern is found and successfully parsed. Returns None otherwise.
                         NOTE: This function does not perform calendrical validation (e.g., 32nd day or 13th month).
        """
        # List of regex patterns for dates. Order might matter if some patterns are subsets of others.
        # TODO: Consider adding calendrical validation if stricter date checking is required.
        date_patterns = [
            # Matches DD/MM/YYYY or DD.MM.YYYY (captures day, month, year)
            r'(\d{1,2})[./](\d{1,2})[./](\d{4})',
            # Matches "DD Month YYYY" in Turkish (case-insensitive for month names, captures day, month name, year)
            r'(\d{1,2})\s+([Oo]cak|[Şş]ubat|[Mm]art|[Nn]isan|[Mm]ayıs|[Hh]aziran|[Tt]emmuz|[Aa]ğustos|[Ee]ylül|[Ee]kim|[Kk]asım|[Aa]ralık)\s+(\d{4})'
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, post_text) # Search for the current pattern in the post text
            if match:
                try:
                    if '/' in pattern or '.' in pattern: # For DD/MM/YYYY or DD.MM.YYYY patterns
                        day, month, year = match.groups()
                        # Standardize to YYYY-MM-DD format, ensuring month/day are two digits (e.g., '01' instead of '1')
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                    else: # For "DD Month YYYY" (Turkish) pattern
                        day, month_name, year = match.groups()
                        # Mapping of Turkish month names (lowercase) to month numbers
                        month_map = {
                            'ocak': '01', 'şubat': '02', 'mart': '03', 
                            'nisan': '04', 'mayıs': '05', 'haziran': '06', 
                            'temmuz': '07', 'ağustos': '08', 'eylül': '09', 
                            'ekim': '10', 'kasım': '11', 'aralık': '12'
                        }
                        month_val = month_map.get(month_name.lower()) # Get month number, case-insensitive
                        if month_val: # If a valid month name was found in our map
                             return f"{year}-{month_val}-{day.zfill(2)}" # Standardize format
                        else: # Log if a month name in text is not in our map (for debugging/extending map)
                            logger.warning(f"Unknown Turkish month name '{month_name}' encountered in date matching pattern '{pattern}'.")
                except Exception as e: # Catch potential errors during date string construction or group extraction
                    logger.warning(f"Error parsing date with pattern '{pattern}' from match '{match.groups()}': {e}")
                    # Pass to try the next pattern if one fails due to parsing error
                    pass
        
        # If no patterns match or all parsing attempts fail for matched patterns
        logger.debug(f"Could not extract date from post text snippet: '{post_text[:100]}...'") # Use debug for less critical logs
        return None
    
    def get_list(self, url):
        """
        Fetches a listing page (a page containing multiple post links) and extracts URLs
        of individual blog posts.

        Args:
            url (str): The URL of the blog post listing page.

        Returns:
            list or bool: A list of unique post URLs (strings) found on the page.
                          Returns False if the request fails, no response is received,
                          or no post links are found on the page, signaling to stop pagination.
        """
        response = self._make_request(url)
        if not response: # If request failed (e.g. max retries reached or redirect that signals end)
            logger.info(f"Failed to get list from {url}, no response or redirect assumed as end. Stopping for this path.")
            return False # Indicate failure or end of listings, signaling to stop for this path
            
        soup = BeautifulSoup(response.content, "html.parser") # Parse HTML content
        hrefs = set() # Use a set to automatically handle duplicate URLs found on the page

        # Attempt to find the main/featured post link first.
        # This handles cases where one post might be styled or located differently (e.g., as a "latest" or "pinned" post).
        main_post_container = soup.find(class_=firstPostClassName)
        if main_post_container:
            main_link_tag = main_post_container.find("a") # Find the 'a' (anchor) tag
            if main_link_tag and main_link_tag.get("href"): # Check if 'a' tag and href attribute exist
                hrefs.add(main_link_tag.get("href"))
        
        # Find all other post titles/links on the page using the common class for titles.
        title_elements = soup.find_all(class_=listClassName)
        for title_element in title_elements:
            a_tag = title_element.find("a") # Find 'a' tag within each title element
            if a_tag and a_tag.get("href"):
                hrefs.add(a_tag.get("href"))

        if not hrefs: # If no links were extracted from the page
            logger.info(f"No post links found on page: {url}. This might be the end of pagination.")
            return False # Indicate that no links were found, potentially end of content
                
        return list(hrefs) # Convert set to list before returning

    def get_blog_post(self, url):
        """
        Fetches an individual blog post page and extracts its title, full text content,
        and attempts to extract a publication date from the text.

        Args:
            url (str): The URL of the individual blog post.

        Returns:
            tuple or None: A tuple containing (title, post_text, post_date) if successful.
                           The post_date can be None if not found or not parsable.
                           Returns None if the request fails or essential content (like title or body)
                           cannot be parsed from the page.
        """
        response = self._make_request(url)
        if not response: # If request failed
            logger.warning(f"Failed to get blog post from {url}, no response received.")
            return None
            
        soup = BeautifulSoup(response.content, "html.parser") # Parse HTML
        # Find the main container for the blog post content using its CSS class
        post_content_container = soup.find(class_=postClassName)
        if not post_content_container:
            logger.error(f"Post content container with class '{postClassName}' not found at {url}. Cannot extract details.")
            return None # Essential element missing
            
        # Extract the title from the post
        title_element = post_content_container.find(class_=postTitleClass)
        if not title_element:
            logger.warning(f"Post title element with class '{postTitleClass}' not found at {url}. Trying fallback (h1/h2).")
            # Fallback: try to get any h1 or h2 as title if specific class fails. Titles are often in these tags.
            title_element = post_content_container.find(['h1', 'h2'])
            if not title_element:
                logger.error(f"Fallback failed: No h1 or h2 title found at {url}. Cannot extract title.")
                return None # If no title can be found, treat as failure to process post
            
        # Clean the title by removing predefined common prefixes and stripping whitespace
        title = title_element.text.replace(stringToRemove, '').replace(stringToRemove2, '').strip()
        # Extract the full text content of the post by getting all text from the container
        post_text = post_content_container.text.strip() # .text gets all descendant text, concatenated
        # Attempt to extract the publication date from the post text
        post_date = self.extract_date(post_text) # This can return None if no date is found
        
        # Basic validation: if both title and text are empty, it's likely a problem page or parsing error.
        if not title and not post_text:
             logger.error(f"Both title and post_text are empty for {url} after parsing. Skipping.")
             return None

        return (title, post_text, post_date)

    def scrape_data(self, refresh=False):
        """
        Main method to orchestrate the scraping process.

        Iterates through pages of blog post listings on the KVKK website,
        extracts URLs of individual posts, scrapes each post for its details
        (title, content, date), and stores this information in the database.

        Args:
            refresh (bool, optional):
                If True: The scraper operates in "refresh" mode. It will stop
                         scraping further pages if it encounters a post that
                         already exists in the database (i.e., `db.insert_post`
                         returns False). This is useful for efficiently finding
                         only new posts since the last scrape.
                If False (default): The scraper operates in "full scrape" mode.
                                   It will attempt to scrape all posts from all
                                   available pages, regardless of whether they
                                   are already in the database.
        """
        page = 1 # Start from the first page of listings
        stop_scraping = False # Flag to control the pagination loop
        
        while not stop_scraping:
            paged_url = f"{baseUrl}{listings}{page}" # Construct URL for the current listing page
            logger.info(f"Scraping page {page}: {paged_url}")
            
            post_urls = self.get_list(paged_url) # Get list of post URLs from the current listing page

            # If no URLs are returned (get_list returns False or an empty list),
            # this typically indicates the end of listings or an issue with the page.
            if not post_urls:
                logger.info(f"No more posts found on {paged_url} or end of listings reached. Stopping scrape.")
                break # Exit the while loop for pagination
                
            logger.info(f"Found {len(post_urls)} posts on page {page}")
            
            for href in post_urls:
                # Construct full URL for the individual post, ensuring it's absolute
                full_url = f"{baseUrl}{href}" if not href.startswith('http') else href
                logger.info(f"Scraping individual post: {full_url}")
                
                try:
                    post_data = self.get_blog_post(full_url) # Scrape the individual post details
                    if not post_data: # If get_blog_post returns None (e.g. failed to parse essential data)
                        logger.warning(f"Failed to extract data from {full_url}, skipping.")
                        continue # Skip to the next post URL in the list
                        
                    title, post_text, post_date = post_data
                    # Attempt to insert the scraped post into the database
                    was_inserted = self.db.insert_post(title, post_text, post_date)
                    
                    # If insertion failed (likely because post already exists) AND refresh mode is active
                    if not was_inserted and refresh:
                        logger.info(f"Found existing post '{title}' in refresh mode. Stopping further scraping of pages.")
                        stop_scraping = True # Set flag to stop pagination after this page's posts are processed
                        break # Exit the for loop for current page's posts
                        
                    # Be polite to the server: wait for a short random interval between requests for individual posts
                    time.sleep(random.uniform(1, 3)) # Random delay between 1 and 3 seconds
                        
                except Exception as e: # Catch any other unexpected errors during the processing of a single post
                    logger.error(f"Unhandled error processing post {full_url}: {e}", exc_info=True) # Log with traceback
            
            if stop_scraping: # Check if the flag to stop was set (e.g., by refresh mode)
                logger.info("Stopping scraping pagination as stop_scraping flag is set.")
                break # Exit the while loop

            page += 1 # Increment page number to fetch the next listing page

            # Safety break for very long scrapes to prevent accidental infinite loops.
            # This can be adjusted or removed if confident in pagination termination logic.
            if page > 1000: # Arbitrary limit to prevent potential infinite loops
                logger.warning(f"Reached page limit ({page}). Stopping scrape to prevent potential infinite loop.")
                break
            
    def send_email_notifications(self):
        """
        Sends email notifications for new, unsent posts.

        Retrieves posts marked with `sent = 0` from the database.
        Formats an email for each post including title, date, and a snippet.
        Uses `smtplib` to connect to the configured SMTP server and send the email.
        If an email is sent successfully, the post is marked as sent in the database.
        Includes error handling for SMTP operations.
        """
        unsent_posts = self.db.get_unsent_posts() # Fetch posts marked with sent = 0
        
        if not unsent_posts:
            logger.info("No new posts to send notifications for.")
            return # Exit if there's nothing to send

        logger.info(f"Found {len(unsent_posts)} posts to send notifications for.")

        # TODO: Consider if the href for each post should be stored in the DB
        # to provide a direct link in the email. Currently, it's not.

        for post_id, title, post_content, post_date in unsent_posts:
            original_subject = f"New KVKK Data Breach Notification: {title}"
            subject = original_subject
            
            keyword_match_found = False
            matched_keywords_list = []

            if KEYWORD_WATCHLIST: # Only check if watchlist is not empty
                for keyword in KEYWORD_WATCHLIST:
                    # Case-insensitive check in title and content
                    if keyword.lower() in title.lower() or keyword.lower() in post_content.lower():
                        keyword_match_found = True
                        matched_keywords_list.append(keyword)
                        # No need to break here if we want to list all matched keywords

            email_body_intro = "A new data breach notification has been published by KVKK."
            if keyword_match_found:
                subject = f"[KEYWORD MATCH] {original_subject}"
                # Prepend matched keywords info to the email body intro
                email_body_intro = f"Matched Keywords: {', '.join(matched_keywords_list)}\n\n{email_body_intro}"
                logger.info(f"Keyword match found for post ID {post_id} ({title}): {', '.join(matched_keywords_list)}")

            # Construct email body
            body_lines = [
                email_body_intro,
                f"\nTitle: {title}",
                f"Publication Date: {post_date if post_date else 'N/A'}",
                f"\nContent Snippet:\n{post_content[:300]}...\n"
                # TODO: Add a direct link here if href is stored in the future.
                # Example: f"Link: {baseUrl}/<some_path_or_id_from_db>"
            ]
            body = "\n".join(body_lines)

            msg = MIMEText(body, 'plain', 'utf-8') # Create MIMEText object, specify plain text and utf-8
            msg['Subject'] = subject
            msg['From'] = SENDER_EMAIL
            msg['To'] = ", ".join(RECIPIENT_EMAILS) # Join list of recipients into a comma-separated string

            try:
                # Connect to SMTP server and send email
                # Using a context manager for the SMTP connection ensures it's properly closed.
                with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                    server.ehlo() # Extended Hello to identify ourselves to the SMTP server
                    if SMTP_PORT == 587: # Standard port for TLS
                        server.starttls() # Upgrade connection to TLS
                        server.ehlo() # Re-identify ourselves over the secure connection

                    # Only attempt login if username and password are provided
                    if SMTP_USERNAME and SMTP_PASSWORD:
                        server.login(SMTP_USERNAME, SMTP_PASSWORD)

                    server.sendmail(SENDER_EMAIL, RECIPIENT_EMAILS, msg.as_string())
                    logger.info(f"Successfully sent email for post ID {post_id}: {title}")
                    self.db.mark_as_sent(post_id) # Mark as sent in DB

                    # Brief pause to avoid overwhelming an SMTP server if sending many emails
                    time.sleep(random.uniform(0.5, 1.5))

            except smtplib.SMTPException as e:
                logger.error(f"SMTP Error sending email for post ID {post_id} ('{title}'): {e}")
            except Exception as e: # Catch any other unexpected errors
                logger.error(f"Unexpected error sending email for post ID {post_id} ('{title}'): {e}", exc_info=True)
        
        if unsent_posts: # Log a summary if there were attempts
             logger.info("Finished processing email notifications.")

    def export_to_csv(self, filename="kvkk_export.csv"):
        """
        Exports all posts from the database to a CSV file.

        Args:
            filename (str, optional): The name of the CSV file to create.
                                      Defaults to "kvkk_export.csv".
        """
        posts = self.db.get_all_posts()
        if not posts:
            logger.info("No data to export to CSV.")
            return

        header = ["id", "title", "post", "post_date", "scraped_date", "sent"]
        try:
            import csv # Import here to keep it local to the method if preferred
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(header)
                writer.writerows(posts)
            logger.info(f"Data successfully exported to {filename}")
        except Exception as e:
            logger.error(f"Error exporting data to CSV file {filename}: {e}", exc_info=True)

    def export_to_json(self, filename="kvkk_export.json"):
        """
        Exports all posts from the database to a JSON file.

        Args:
            filename (str, optional): The name of the JSON file to create.
                                      Defaults to "kvkk_export.json".
        """
        posts_tuples = self.db.get_all_posts()
        if not posts_tuples:
            logger.info("No data to export to JSON.")
            return

        header = ["id", "title", "post", "post_date", "scraped_date", "sent"]
        # Convert list of tuples to list of dictionaries
        posts_list_of_dicts = [dict(zip(header, row)) for row in posts_tuples]
        
        try:
            import json # Import here
            with open(filename, 'w', encoding='utf-8') as jsonfile:
                json.dump(posts_list_of_dicts, jsonfile, indent=4, ensure_ascii=False)
            logger.info(f"Data successfully exported to {filename}")
        except Exception as e:
            logger.error(f"Error exporting data to JSON file {filename}: {e}", exc_info=True)


def main():
    """
    Main function to run the KVKK scraper application.

    Provides a simple command-line interface (CLI) to choose scraping actions:
    1. Get all posts: Scrapes all available history from the KVKK website. This can be time-consuming.
    2. Refresh DB: Scrapes only new posts since the last run, stopping when the first existing post is found in the DB.
    3. Send mail: Placeholder for future email notification functionality for newly scraped posts.
    """
    db = None # Initialize db to None to ensure it's defined in the `finally` block, even if Database() instantiation fails.
    try:
        db = Database() # Initialize the database connection. This also creates tables if they don't exist.
        scraper = KvkkScraper(db) # Initialize the scraper, passing the database instance.
    
        # Display menu options to the user via the console.
        print('''
    KVKK Data Breach Scraper Menu:
    1. Get all posts (scrapes all history, may take significant time)
    2. Refresh DB to get new posts (stops when the first existing post is found)
    3. Send mail notifications
    4. Export all data to CSV
    5. Export all data to JSON
    ''')
    
        selection = input("Select an option (1-5): ") # Get user's choice from input.

        if selection == "1":
            logger.info("Starting scrape for all posts (refresh=False)...")
            scraper.scrape_data(refresh=False) # Call scrape_data in "full scrape" mode.
            logger.info("Finished scraping all posts.")
        elif selection == "2":
            logger.info("Starting refresh scrape for new posts (refresh=True)...")
            scraper.scrape_data(refresh=True) # Call scrape_data in "refresh" mode.
            logger.info("Finished refreshing posts.")
        elif selection == "3":
            logger.info("Attempting to send email notifications...")
            scraper.send_email_notifications()
        elif selection == "4":
            logger.info("Exporting data to CSV...")
            scraper.export_to_csv() # Placeholder, will be implemented
        elif selection == "5":
            logger.info("Exporting data to JSON...")
            scraper.export_to_json() # Placeholder, will be implemented
        else:
            print('Unknown selection. Please run again and choose a valid option (1-5).')
            # Note: Calling main() recursively here for invalid input is generally discouraged for robustness,
            # as it can lead to a deep recursion stack on repeated errors. A loop within main() or simply exiting
            # are often better alternatives for more complex CLIs.
    except KeyboardInterrupt: # Gracefully handle Ctrl+C from the user to terminate the script.
        logger.info("Process interrupted by user (Ctrl+C). Exiting.")
    except Exception as e: # Catch any other unexpected errors in the main execution flow.
        logger.error(f"An unexpected error occurred in the main function: {e}", exc_info=True) # Log with traceback.
    finally:
        if db: # Ensure database connection is closed if it was successfully opened.
            db.close()
            logger.info("Main function finished. Database connection closed if it was open.")

if __name__ == "__main__":
    # This standard Python construct ensures that main() is called only when the script
    # is executed directly (e.g., by running `python scraper.py`), and not when it's
    # imported as a module into another script. This is good practice for reusable code.
    main()