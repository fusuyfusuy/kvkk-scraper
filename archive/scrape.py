import requests
from bs4 import BeautifulSoup
import sqlite3
import time 
import random
import logging
import re
from datetime import datetime

# 
# LOGGING CONFIG
# 
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("scraper.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 
# USER AGENTS
# 
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
    def __init__(self, db_path='database.db'):
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        self._create_tables()
    
    def _create_tables(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS blog_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL UNIQUE,
                post TEXT NOT NULL,
                post_date TEXT,
                scraped_date TEXT NOT NULL,
                sent INTEGER NOT NULL DEFAULT 0
            )
        ''')
        self.conn.commit()
    
    def insert_post(self, title, post, post_date=None):
        try:
            scraped_date = datetime.now().isoformat()
            self.cursor.execute(
                'INSERT INTO blog_posts (title, post, post_date, scraped_date) VALUES (?, ?, ?, ?)', 
                (title, post, post_date, scraped_date)
            )
            self.conn.commit()
            return True
        except sqlite3.IntegrityError as e:
            logger.warning(f"Post already exists: {title}")
            return False
        except Exception as e:
            logger.error(f"Database error: {e}")
            return False
    
    def get_unsent_posts(self):
        try:
            self.cursor.execute('SELECT id, title, post, post_date FROM blog_posts WHERE sent = 0')
            return self.cursor.fetchall()
        except Exception as e:
            logger.error(f"Error fetching unsent posts: {e}")
            return []
    
    def mark_as_sent(self, post_id):
        try:
            self.cursor.execute('UPDATE blog_posts SET sent = 1 WHERE id = ?', (post_id,))
            self.conn.commit()
        except Exception as e:
            logger.error(f"Error marking post as sent: {e}")
    
    def close(self):
        self.conn.close()

# 
# CONSTANT VARIABLES
# 
baseUrl = "https://www.kvkk.gov.tr"
listings = "/veri-ihlali-bildirimi/?&page="
listClassName = "blog-grid-title"
firstPostClassName = "blog-post-container"
postClassName = "blog-post-inner"
postTitleClass = "blog-post-title"
stringToRemove = "Kamuoyu Duyurusu (Veri İhlali Bildirimi) – "
stringToRemove2 = "Kamuoyu Duyurusu (Veri İhlali Bildirimi) - "
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

class KvkkScraper:
    def __init__(self, db):
        self.db = db
    
    def _get_random_headers(self):
        return {'User-Agent': random.choice(user_agents)}
    
    def _make_request(self, url, max_retries=MAX_RETRIES):
        """Make request with retry mechanism for transient errors"""
        for attempt in range(max_retries):
            try:
                headers = self._get_random_headers()
                response = requests.get(url, allow_redirects=False, headers=headers, timeout=30)
                if response.status_code == 200:
                    return response
                elif response.status_code == 302:
                    logger.info(f"Redirect encountered at {url}")
                    return None
                else:
                    logger.warning(f"Request failed with status code {response.status_code}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Request error: {e}")
            
            # Exponential backoff
            if attempt < max_retries - 1:
                sleep_time = RETRY_DELAY * (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"Retrying in {sleep_time:.2f} seconds...")
                time.sleep(sleep_time)
        
        return None
    
    def extract_date(self, post_text):
        """Extract date from the post content using regex"""
        # Common date patterns in KVKK posts
        date_patterns = [
            r'(\d{1,2})[./](\d{1,2})[./](\d{4})',  # DD/MM/YYYY or DD.MM.YYYY
            r'(\d{1,2}) ([Oo]cak|[Şş]ubat|[Mm]art|[Nn]isan|[Mm]ayıs|[Hh]aziran|[Tt]emmuz|[Aa]ğustos|[Ee]ylül|[Ee]kim|[Kk]asım|[Aa]ralık) (\d{4})'  # DD Month YYYY in Turkish
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, post_text)
            if match:
                try:
                    if '/' in pattern or '.' in pattern:
                        day, month, year = match.groups()
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                    else:
                        day, month_name, year = match.groups()
                        # Convert Turkish month name to number
                        month_map = {
                            'ocak': '01', 'şubat': '02', 'mart': '03', 
                            'nisan': '04', 'mayıs': '05', 'haziran': '06', 
                            'temmuz': '07', 'ağustos': '08', 'eylül': '09', 
                            'ekim': '10', 'kasım': '11', 'aralık': '12'
                        }
                        month = month_map.get(month_name.lower(), '01')
                        return f"{year}-{month}-{day.zfill(2)}"
                except:
                    pass
        
        return None
    
    def get_list(self, url):
        """Get list of post URLs from a page"""
        response = self._make_request(url)
        if not response:
            return False
            
        soup = BeautifulSoup(response.content, "html.parser")
        hrefs = []

        # Get main post
        main_post = soup.find(class_=firstPostClassName)
        if main_post:
            main_link = main_post.find("a")
            if main_link and main_link.get("href"):
                hrefs.append(main_link.get("href"))
        
        # Get other posts
        titles = soup.find_all(class_=listClassName)
        for title_element in titles:
            a_tag = title_element.find("a")
            if a_tag and a_tag.get("href"):
                hrefs.append(a_tag.get("href"))
                
        return hrefs

    def get_blog_post(self, url):
        """Extract title, content and date from a blog post"""
        response = self._make_request(url)
        if not response:
            return None
            
        soup = BeautifulSoup(response.content, "html.parser")
        post = soup.find(class_=postClassName)
        if not post:
            logger.error(f"Post content not found at {url}")
            return None
            
        title_element = post.find(class_=postTitleClass)
        if not title_element:
            logger.error(f"Post title not found at {url}")
            return None
            
        title = title_element.text.replace(stringToRemove, '').replace(stringToRemove2, '').strip()
        post_text = post.text.strip()
        post_date = self.extract_date(post_text)
        
        return (title, post_text, post_date)

    def scrape_data(self, refresh=False):
        """Main scraping function"""
        page = 1
        stop = False
        
        while not stop:
            paged_url = f"{baseUrl}{listings}{page}"
            logger.info(f"Scraping page {page}")
            
            hrefs = self.get_list(paged_url)
            if not hrefs:
                logger.info(f"Reached the end at page {page}")
                break
                
            logger.info(f"Found {len(hrefs)} posts on page {page}")
            
            for href in hrefs:
                full_url = f"{baseUrl}{href}"
                logger.info(f"Scraping {full_url}")
                
                try:
                    post_data = self.get_blog_post(full_url)
                    if not post_data:
                        logger.warning(f"Failed to extract data from {full_url}")
                        continue
                        
                    title, post_text, post_date = post_data
                    success = self.db.insert_post(title, post_text, post_date)
                    
                    if not success and refresh:
                        logger.info("Found existing post in refresh mode, stopping...")
                        stop = True
                        break
                        
                    # Be polite to the server
                    time.sleep(random.uniform(1, 3))
                        
                except Exception as e:
                    logger.error(f"Error processing {href}: {e}")
            
            page += 1
            
    def send_email_notifications(self):
        """Send email notifications for new posts"""
        # This is a placeholder for the email sending functionality
        # You'll need to implement the actual email sending logic
        unsent_posts = self.db.get_unsent_posts()
        
        if not unsent_posts:
            logger.info("No new posts to send notifications for")
            return
            
        logger.info(f"Found {len(unsent_posts)} posts to send notifications for")
        
        # TODO: Implement email sending functionality
        # For each post in unsent_posts, send an email and then:
        # for post in unsent_posts:
        #     post_id, title, content, date = post
        #     # Send email logic here
        #     self.db.mark_as_sent(post_id)
        
        logger.info("Email functionality not yet implemented")

def main():
    db = Database()
    scraper = KvkkScraper(db)
    
    print('''
    1. Get all posts
    2. Refresh db to get new posts
    3. Send mail
    ''')
    
    try:
        selection = input("Select: ")
        if selection == "1":
            scraper.scrape_data(refresh=False)
        elif selection == "2":
            scraper.scrape_data(refresh=True)
        elif selection == "3":
            scraper.send_email_notifications()
        else:
            print('Unknown selection.')
            main()
    finally:
        db.close()

if __name__ == "__main__":
    main()