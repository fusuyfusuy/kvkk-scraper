import requests
from bs4 import BeautifulSoup
import sqlite3
import time 
import random

# 
# USER AGENTS
# 
user_agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15'
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15'
]



# 
# DATABASE CONFIG
# 
# Connect to or create an SQLite database
conn = sqlite3.connect('database.db')

# Create a cursor
cursor = conn.cursor()

# Create a table if it doesn't exist
cursor.execute('''
    CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        post TEXT NOT NULL
    )
''')

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

def getList(url):
	headers = {'User-Agent': random.choice(user_agents)}
	response = requests.get(url, allow_redirects=False, headers=headers)
	if (response.status_code != 200):
		return False
	soup = BeautifulSoup(response.content, "html.parser")
	hrefs = []

	mainTitle = soup.find(class_=firstPostClassName)
	mainTitle = mainTitle.find("a")
	if (mainTitle):
		mainTitle = mainTitle.get("href")
		hrefs.append(mainTitle)
	titles = soup.find_all(class_=listClassName)
	for title_element in titles:
		a_tag = title_element.find("a")
		if a_tag:
			href = a_tag.get("href")
			hrefs.append(href)
	return hrefs

def getBlogPost(url):
	headers = {'User-Agent': random.choice(user_agents)}
	response = requests.get(url, allow_redirects=True, headers=headers)
	soup = BeautifulSoup(response.content, "html.parser")
	post = soup.find(class_=postClassName)
	title = post.find(class_=postTitleClass)
	title = title.text.replace(stringToRemove, '')
	return (title, post.text)


i = 1
while True:
	pagedUrl = f"{baseUrl}{listings}{str(i)}"
	print(f"- Scraping page {i}")
	try:
		hrefs = getList(pagedUrl)
	except Exception as e:
		print(f"====== Something went wrong, {e}")
		continue
	if (not hrefs):
		print(f"-- Response is 302 for page {i}, stopping.")
		break
	print(f"-- Found {len(hrefs)} posts.")
	for href in hrefs:
		print(f"-- Scraping {href}")
		try:
			post = getBlogPost(f"{baseUrl}{href}")
			cursor.execute('INSERT INTO blog_posts (title, post) VALUES (?, ?)', (post[0], post[1]))
			conn.commit()
		except Exception as e:
			print(f"====== Error on {href}, error is {e}")
		time.sleep(1)
	i = i+1

